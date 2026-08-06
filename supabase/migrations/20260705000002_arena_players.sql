-- Arena v1.5 — the daily-return loop: server-side bankrolls, daily claim with
-- streaks, and automatic parimutuel settlement. Makes the leaderboard truth.
--
-- Players stay anonymous (client-generated uuid). All chip movement goes
-- through SECURITY DEFINER RPCs so bankrolls can't be edited directly; the
-- known v1 gap is that a fresh client_id gets a fresh bankroll (fine while
-- chips are virtual with no cash value).

CREATE TABLE IF NOT EXISTS public.arena_players (
  client_id uuid PRIMARY KEY,
  handle text NOT NULL DEFAULT '',
  bankroll integer NOT NULL DEFAULT 1000 CHECK (bankroll >= 0),
  streak_days integer NOT NULL DEFAULT 0,
  last_claim_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.arena_players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "arena players are public" ON public.arena_players;
CREATE POLICY "arena players are public"
  ON public.arena_players FOR SELECT USING (true);
-- no INSERT/UPDATE policies: only the RPCs below (SECURITY DEFINER) write.

ALTER TABLE public.arena_stakes ADD COLUMN IF NOT EXISTS settled boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS arena_stakes_unsettled_idx ON public.arena_stakes (game_id) WHERE NOT settled;

-- ---------------------------------------------------------------------------
-- arena_claim_daily — the daily ritual. 200 + 50/consecutive-day (cap day 7).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.arena_claim_daily(p_client uuid, p_handle text DEFAULT '')
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_player arena_players;
  v_bonus integer := 0;
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
  END IF;

  RETURN jsonb_build_object(
    'claimed', v_bonus,
    'bankroll', v_player.bankroll,
    'streak_days', v_player.streak_days,
    'last_claim_date', v_player.last_claim_date,
    'handle', v_player.handle
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- arena_place_stake — debit bankroll + record the stake atomically.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.arena_place_stake(
  p_client uuid, p_game uuid, p_side text, p_amount integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_bankroll integer;
  v_status text;
BEGIN
  IF p_side NOT IN ('home', 'away') OR p_amount < 1 OR p_amount > 500 THEN
    RAISE EXCEPTION 'invalid stake';
  END IF;
  SELECT status INTO v_status FROM games WHERE id = p_game;
  IF v_status IS NULL OR v_status = 'completed' THEN
    RAISE EXCEPTION 'game not open';
  END IF;

  SELECT bankroll INTO v_bankroll FROM arena_players
  WHERE client_id = p_client FOR UPDATE;
  IF v_bankroll IS NULL THEN
    RAISE EXCEPTION 'no player — claim daily chips first';
  END IF;
  IF v_bankroll < p_amount THEN
    RAISE EXCEPTION 'insufficient bankroll';
  END IF;

  UPDATE arena_players SET bankroll = bankroll - p_amount, updated_at = now()
  WHERE client_id = p_client;
  INSERT INTO arena_stakes (game_id, client_id, side, amount)
  VALUES (p_game, p_client, p_side, p_amount);

  RETURN jsonb_build_object('bankroll', v_bankroll - p_amount);
END;
$$;

-- ---------------------------------------------------------------------------
-- arena_settle_game — parimutuel payout for a completed game. Winners split
-- the whole pot pro-rata; ties refund everyone. Idempotent via settled flag.
-- Called by the arena-live-odds function (service role) each cron tick.
-- ---------------------------------------------------------------------------
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
  IF v_game.id IS NULL OR v_game.status <> 'completed' THEN
    RETURN jsonb_build_object('settled', false, 'reason', 'not completed');
  END IF;

  SELECT coalesce(sum(amount), 0) INTO v_pot
  FROM arena_stakes WHERE game_id = p_game AND NOT settled;
  IF v_pot = 0 THEN
    RETURN jsonb_build_object('settled', true, 'paid_players', 0);
  END IF;

  IF coalesce(v_game.home_score, 0) = coalesce(v_game.away_score, 0) THEN
    -- tie: refund every unsettled stake
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
    IF v_winner_total > 0 THEN
      WITH winners AS (
        SELECT client_id, sum(amount) AS amt
        FROM arena_stakes
        WHERE game_id = p_game AND NOT settled AND side = v_winner
        GROUP BY client_id
      )
      UPDATE arena_players p
      SET bankroll = p.bankroll + floor(w.amt::numeric * v_pot / v_winner_total)::integer,
          updated_at = now()
      FROM winners w WHERE p.client_id = w.client_id;
      GET DIAGNOSTICS v_paid = ROW_COUNT;
    END IF;
  END IF;

  UPDATE arena_stakes SET settled = true WHERE game_id = p_game AND NOT settled;
  RETURN jsonb_build_object('settled', true, 'paid_players', v_paid, 'pot', v_pot);
END;
$$;

-- Anonymous web clients call claim + stake; settle is service-role only.
GRANT EXECUTE ON FUNCTION public.arena_claim_daily(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.arena_place_stake(uuid, uuid, text, integer) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.arena_settle_game(uuid) FROM anon, authenticated, public;
