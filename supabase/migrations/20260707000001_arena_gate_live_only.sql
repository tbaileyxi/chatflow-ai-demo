-- Fix: gates must only close on LIVE battles that are decided. A pregame
-- 85% favorite (Argentina at noon) is a legitimate low-payout bet, not a
-- closed gate. Same function otherwise.

CREATE OR REPLACE FUNCTION public.arena_place_stake_v2(
  p_client uuid, p_side text, p_amount integer,
  p_game uuid DEFAULT NULL, p_event uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_bankroll integer;
  v_status text;
  v_prob numeric;
BEGIN
  IF p_side NOT IN ('home', 'away') OR p_amount < 1 OR p_amount > 500 THEN
    RAISE EXCEPTION 'invalid stake';
  END IF;
  IF (p_game IS NULL) = (p_event IS NULL) THEN
    RAISE EXCEPTION 'stake exactly one target';
  END IF;

  IF p_game IS NOT NULL THEN
    SELECT status INTO v_status FROM games WHERE id = p_game;
    IF v_status IS NULL OR v_status IN ('final', 'completed') THEN
      RAISE EXCEPTION 'game not open';
    END IF;
    IF v_status IN ('live', 'in_progress') THEN
      SELECT home_prob INTO v_prob FROM arena_live_odds
      WHERE game_id = p_game AND updated_at > now() - interval '10 minutes';
      IF v_prob IS NOT NULL AND (v_prob >= 0.85 OR v_prob <= 0.15) THEN
        RAISE EXCEPTION 'gates closed — battle is decided';
      END IF;
    END IF;
  ELSE
    SELECT status, prob_a INTO v_status, v_prob FROM arena_events WHERE id = p_event;
    IF v_status IS NULL OR v_status = 'final' THEN
      RAISE EXCEPTION 'event not open';
    END IF;
    -- only in-play sports events gate; 24/7 markets and pregame never do
    IF v_status = 'live' AND p_event IN (SELECT id FROM arena_events WHERE category IN ('worldcup', 'prop'))
       AND v_prob IS NOT NULL AND (v_prob >= 0.85 OR v_prob <= 0.15) THEN
      RAISE EXCEPTION 'gates closed — battle is decided';
    END IF;
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
  INSERT INTO arena_stakes (game_id, event_id, client_id, side, amount)
  VALUES (p_game, p_event, p_client, p_side, p_amount);

  RETURN jsonb_build_object('bankroll', v_bankroll - p_amount);
END;
$$;
