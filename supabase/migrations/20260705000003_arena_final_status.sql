-- Fix: games finish as status 'final' (per games_status_check), not
-- 'completed'. Update both arena RPCs to match; accept either value
-- defensively. Also the one-time cleanup of stale in_progress rows.

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
  IF v_status IS NULL OR v_status IN ('final', 'completed') THEN
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

-- One-time cleanup: close out stale rows stuck at live/in_progress. The next
-- arena-live-odds cron tick then settles (refunds, if 0-0) their stakes.
UPDATE games SET status = 'final'
WHERE status IN ('live', 'in_progress')
  AND start_time < now() - interval '24 hours';
