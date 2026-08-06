-- Predictions v2 — App Store-safe wording.
-- The chips game is a free-to-play prediction game, not gambling. Reword the
-- two user-facing exceptions in place_shadow_bet that surface in the app
-- ("bet"/"betting" → "pick"). Body is otherwise identical to the prior
-- definition (20260213213107). No schema change.

CREATE OR REPLACE FUNCTION public.place_shadow_bet(p_market_id uuid, p_huddle_id uuid, p_position text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_yes_price integer;
  v_chips_cost integer;
  v_current_chips integer;
  v_minimum_chips integer;
  v_is_premium boolean;
  v_market_resolved boolean;
  v_event_start timestamptz;
  v_bet_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_position NOT IN ('YES', 'NO') THEN
    RAISE EXCEPTION 'Position must be YES or NO';
  END IF;

  -- Get market info
  SELECT current_yes_price, is_resolved, event_start_time
  INTO v_yes_price, v_market_resolved, v_event_start
  FROM kalshi_markets WHERE id = p_market_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Market not found'; END IF;
  IF v_market_resolved THEN RAISE EXCEPTION 'This pick is already final'; END IF;

  -- Lock picks 5 min before game
  IF v_event_start IS NOT NULL AND v_event_start <= (now() + interval '5 minutes') THEN
    RAISE EXCEPTION 'Picks are locked for this game';
  END IF;

  -- Check duplicate
  IF EXISTS (SELECT 1 FROM shadow_bets WHERE user_id = v_user_id AND market_id = p_market_id) THEN
    RAISE EXCEPTION 'You already made a pick here';
  END IF;

  -- Calculate cost
  IF p_position = 'YES' THEN
    v_chips_cost := v_yes_price;
  ELSE
    v_chips_cost := 100 - v_yes_price;
  END IF;
  IF v_chips_cost < 1 THEN v_chips_cost := 1; END IF;
  IF v_chips_cost > 99 THEN v_chips_cost := 99; END IF;

  -- Ensure portfolio exists
  INSERT INTO user_portfolios (user_id, total_chips)
  VALUES (v_user_id, 1000)
  ON CONFLICT (user_id) DO NOTHING;

  -- Get chips and premium status
  SELECT total_chips, COALESCE(minimum_chips, 0), COALESCE(is_premium, false)
  INTO v_current_chips, v_minimum_chips, v_is_premium
  FROM user_portfolios WHERE user_id = v_user_id FOR UPDATE;

  -- Enforce minimum chips floor
  IF v_current_chips - v_chips_cost < v_minimum_chips THEN
    IF v_is_premium THEN
      RAISE EXCEPTION 'Not enough chips above your 100¢ safety floor (you have %¢, need %¢, floor %¢)', v_current_chips, v_chips_cost, v_minimum_chips;
    ELSE
      IF v_current_chips < v_chips_cost THEN
        RAISE EXCEPTION 'OUT_OF_CHIPS:Not enough chips (you have %¢, need %¢). Upgrade to Premium to keep playing!', v_current_chips, v_chips_cost;
      END IF;
    END IF;
  END IF;

  -- Deduct chips
  UPDATE user_portfolios
  SET total_chips = total_chips - v_chips_cost,
      total_bets = total_bets + 1,
      updated_at = now()
  WHERE user_id = v_user_id;

  -- Insert pick
  INSERT INTO shadow_bets (user_id, market_id, huddle_id, position, chips_risked, potential_payout)
  VALUES (v_user_id, p_market_id, p_huddle_id, p_position, v_chips_cost, 100)
  RETURNING id INTO v_bet_id;

  RETURN jsonb_build_object(
    'bet_id', v_bet_id,
    'chips_risked', v_chips_cost,
    'potential_payout', 100,
    'remaining_chips', v_current_chips - v_chips_cost
  );
END;
$function$;
