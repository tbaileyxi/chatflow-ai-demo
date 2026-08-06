-- Arena v2.1 — three things:
--   1. arena_ticks: probability history per battle, so the arena draws the
--      price river (Polymarket-style) instead of a naked line.
--   2. recorded payouts on arena_stakes, so MY BETS shows WON +400 / LOST -100.
--   3. broke-player bailout in the daily claim (+150 when bankroll < 100,
--      doesn't advance the streak) so nobody is dead-ended until tomorrow.

CREATE TABLE IF NOT EXISTS public.arena_ticks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  target uuid NOT NULL,             -- games.id or arena_events.id
  prob numeric NOT NULL CHECK (prob > 0 AND prob < 1),  -- P(side A / away)
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS arena_ticks_target_idx ON public.arena_ticks (target, created_at DESC);

ALTER TABLE public.arena_ticks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "arena ticks are public" ON public.arena_ticks;
CREATE POLICY "arena ticks are public"
  ON public.arena_ticks FOR SELECT USING (true);
-- writes: service role only (sync functions)

ALTER TABLE public.arena_stakes ADD COLUMN IF NOT EXISTS payout integer;

-- claim with bailout
CREATE OR REPLACE FUNCTION public.arena_claim_daily(p_client uuid, p_handle text DEFAULT '')
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_player arena_players;
  v_bonus integer := 0;
  v_bailout boolean := false;
  v_handle text := left(regexp_replace(coalesce(p_handle, ''), '[^a-zA-Z0-9_ -]', '', 'g'), 20);
BEGIN
  INSERT INTO arena_players (client_id, handle)
  VALUES (p_client, v_handle)
  ON CONFLICT (client_id) DO UPDATE
    SET handle = CASE WHEN v_handle <> '' THEN v_handle ELSE arena_players.handle END,
        updated_at = now()
  RETURNING * INTO v_player;

  IF v_player.last_claim_date IS DISTINCT FROM current_date THEN
    v_player.streak_days := CASE
      WHEN v_player.last_claim_date = current_date - 1 THEN v_player.streak_days + 1
      ELSE 1
    END;
    v_bonus := 200 + 50 * least(v_player.streak_days, 7);
    UPDATE arena_players
    SET bankroll = bankroll + v_bonus,
        streak_days = v_player.streak_days,
        last_claim_date = current_date,
        updated_at = now()
    WHERE client_id = p_client
    RETURNING * INTO v_player;
  ELSIF v_player.bankroll < 100 THEN
    v_bonus := 150; v_bailout := true;
    UPDATE arena_players
    SET bankroll = bankroll + v_bonus, updated_at = now()
    WHERE client_id = p_client
    RETURNING * INTO v_player;
  END IF;

  RETURN jsonb_build_object(
    'claimed', v_bonus, 'bailout', v_bailout,
    'bankroll', v_player.bankroll,
    'streak_days', v_player.streak_days,
    'last_claim_date', v_player.last_claim_date,
    'handle', v_player.handle
  );
END;
$$;

-- settle (games) with per-stake payout recording
CREATE OR REPLACE FUNCTION public.arena_settle_game(p_game uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_game games;
  v_winner text;
  v_pot bigint;
  v_winner_total bigint;
  v_paid integer := 0;
BEGIN
  SELECT * INTO v_game FROM games WHERE id = p_game;
  IF v_game.id IS NULL OR v_game.status NOT IN ('final', 'completed') THEN
    RETURN jsonb_build_object('settled', false, 'reason', 'not final');
  END IF;

  SELECT coalesce(sum(amount), 0) INTO v_pot
  FROM arena_stakes WHERE game_id = p_game AND NOT settled;
  IF v_pot = 0 THEN
    RETURN jsonb_build_object('settled', true, 'paid_players', 0);
  END IF;

  IF coalesce(v_game.home_score, 0) = coalesce(v_game.away_score, 0) THEN
    UPDATE arena_stakes SET payout = amount WHERE game_id = p_game AND NOT settled;
    WITH refunds AS (
      SELECT client_id, sum(amount) AS amt
      FROM arena_stakes WHERE game_id = p_game AND NOT settled
      GROUP BY client_id
    )
    UPDATE arena_players p SET bankroll = p.bankroll + r.amt, updated_at = now()
    FROM refunds r WHERE p.client_id = r.client_id;
    GET DIAGNOSTICS v_paid = ROW_COUNT;
  ELSE
    v_winner := CASE WHEN coalesce(v_game.home_score, 0) > coalesce(v_game.away_score, 0)
                THEN 'home' ELSE 'away' END;
    SELECT coalesce(sum(amount), 0) INTO v_winner_total
    FROM arena_stakes WHERE game_id = p_game AND NOT settled AND side = v_winner;
    UPDATE arena_stakes SET payout = 0 WHERE game_id = p_game AND NOT settled AND side <> v_winner;
    IF v_winner_total > 0 THEN
      UPDATE arena_stakes
      SET payout = floor(amount::numeric * v_pot / v_winner_total)::integer
      WHERE game_id = p_game AND NOT settled AND side = v_winner;
      WITH winners AS (
        SELECT client_id, sum(payout) AS amt
        FROM arena_stakes
        WHERE game_id = p_game AND NOT settled AND side = v_winner
        GROUP BY client_id
      )
      UPDATE arena_players p SET bankroll = p.bankroll + w.amt, updated_at = now()
      FROM winners w WHERE p.client_id = w.client_id;
      GET DIAGNOSTICS v_paid = ROW_COUNT;
    END IF;
  END IF;

  UPDATE arena_stakes SET settled = true WHERE game_id = p_game AND NOT settled;
  RETURN jsonb_build_object('settled', true, 'paid_players', v_paid, 'pot', v_pot);
END;
$$;

-- settle (events) with per-stake payout recording
CREATE OR REPLACE FUNCTION public.arena_settle_event(p_event uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_ev arena_events;
  v_side text;
  v_pot bigint;
  v_winner_total bigint;
  v_paid integer := 0;
BEGIN
  SELECT * INTO v_ev FROM arena_events WHERE id = p_event;
  IF v_ev.id IS NULL OR v_ev.status <> 'final' OR v_ev.winner IS NULL THEN
    RETURN jsonb_build_object('settled', false, 'reason', 'not final/graded');
  END IF;

  SELECT coalesce(sum(amount), 0) INTO v_pot
  FROM arena_stakes WHERE event_id = p_event AND NOT settled;
  IF v_pot = 0 THEN
    RETURN jsonb_build_object('settled', true, 'paid_players', 0);
  END IF;

  IF v_ev.winner = 'tie' THEN
    UPDATE arena_stakes SET payout = amount WHERE event_id = p_event AND NOT settled;
    WITH refunds AS (
      SELECT client_id, sum(amount) AS amt
      FROM arena_stakes WHERE event_id = p_event AND NOT settled
      GROUP BY client_id
    )
    UPDATE arena_players p SET bankroll = p.bankroll + r.amt, updated_at = now()
    FROM refunds r WHERE p.client_id = r.client_id;
    GET DIAGNOSTICS v_paid = ROW_COUNT;
  ELSE
    v_side := CASE WHEN v_ev.winner = 'a' THEN 'away' ELSE 'home' END;
    SELECT coalesce(sum(amount), 0) INTO v_winner_total
    FROM arena_stakes WHERE event_id = p_event AND NOT settled AND side = v_side;
    UPDATE arena_stakes SET payout = 0 WHERE event_id = p_event AND NOT settled AND side <> v_side;
    IF v_winner_total > 0 THEN
      UPDATE arena_stakes
      SET payout = floor(amount::numeric * v_pot / v_winner_total)::integer
      WHERE event_id = p_event AND NOT settled AND side = v_side;
      WITH winners AS (
        SELECT client_id, sum(payout) AS amt
        FROM arena_stakes
        WHERE event_id = p_event AND NOT settled AND side = v_side
        GROUP BY client_id
      )
      UPDATE arena_players p SET bankroll = p.bankroll + w.amt, updated_at = now()
      FROM winners w WHERE p.client_id = w.client_id;
      GET DIAGNOSTICS v_paid = ROW_COUNT;
    END IF;
  END IF;

  UPDATE arena_stakes SET settled = true WHERE event_id = p_event AND NOT settled;
  RETURN jsonb_build_object('settled', true, 'paid_players', v_paid, 'pot', v_pot);
END;
$$;
