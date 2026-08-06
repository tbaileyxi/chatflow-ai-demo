-- Fix: streaks ran on UTC days, so a 9pm ET claim burned "tomorrow" and the
-- streak stuck. The client now passes its local calendar date; server uses it.

CREATE OR REPLACE FUNCTION public.arena_claim_daily(
  p_client uuid, p_handle text DEFAULT '', p_day date DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_player arena_players;
  v_bonus integer := 0;
  v_bailout boolean := false;
  v_today date := coalesce(p_day, current_date);
  v_handle text := left(regexp_replace(coalesce(p_handle, ''), '[^a-zA-Z0-9_ -]', '', 'g'), 20);
BEGIN
  -- sanity: client-supplied day must be within a day of server time
  IF abs(v_today - current_date) > 1 THEN v_today := current_date; END IF;

  INSERT INTO arena_players (client_id, handle)
  VALUES (p_client, v_handle)
  ON CONFLICT (client_id) DO UPDATE
    SET handle = CASE WHEN v_handle <> '' THEN v_handle ELSE arena_players.handle END,
        updated_at = now()
  RETURNING * INTO v_player;

  IF v_player.last_claim_date IS DISTINCT FROM v_today
     AND (v_player.last_claim_date IS NULL OR v_player.last_claim_date < v_today) THEN
    v_player.streak_days := CASE
      WHEN v_player.last_claim_date = v_today - 1 THEN v_player.streak_days + 1
      ELSE 1
    END;
    v_bonus := 200 + 50 * least(v_player.streak_days, 7);
    UPDATE arena_players
    SET bankroll = bankroll + v_bonus,
        streak_days = v_player.streak_days,
        last_claim_date = v_today,
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
