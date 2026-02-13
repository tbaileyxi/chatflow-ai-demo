
-- Phase 1: Premium Subscription & Wallet System

-- 1. Add premium columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_premium boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS premium_since timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS premium_expires_at timestamptz;

-- Note: stripe_customer_id and stripe_subscription_id may already exist from other features
-- Use IF NOT EXISTS pattern
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'stripe_customer_id') THEN
    ALTER TABLE public.profiles ADD COLUMN stripe_customer_id text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'stripe_subscription_id') THEN
    ALTER TABLE public.profiles ADD COLUMN stripe_subscription_id text;
  END IF;
END $$;

-- 2. Add premium-aware columns to user_portfolios
ALTER TABLE public.user_portfolios ADD COLUMN IF NOT EXISTS is_premium boolean DEFAULT false;
ALTER TABLE public.user_portfolios ADD COLUMN IF NOT EXISTS starting_chips integer DEFAULT 1000;
ALTER TABLE public.user_portfolios ADD COLUMN IF NOT EXISTS minimum_chips integer DEFAULT 0;

-- 3. Update place_shadow_bet to enforce minimum_chips floor
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
  IF v_market_resolved THEN RAISE EXCEPTION 'Market already resolved'; END IF;

  -- Lock betting 5 min before game
  IF v_event_start IS NOT NULL AND v_event_start <= (now() + interval '5 minutes') THEN
    RAISE EXCEPTION 'Betting is locked for this market';
  END IF;

  -- Check duplicate
  IF EXISTS (SELECT 1 FROM shadow_bets WHERE user_id = v_user_id AND market_id = p_market_id) THEN
    RAISE EXCEPTION 'You already placed a bet on this market';
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
      -- Premium users: allow bet only if they have enough above the floor
      RAISE EXCEPTION 'Not enough chips above your 100¢ safety floor (you have %¢, need %¢, floor %¢)', v_current_chips, v_chips_cost, v_minimum_chips;
    ELSE
      -- Free users: blocked at 0
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

  -- Insert bet
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

-- 4. Update reset_weekly_chips for premium awareness
CREATE OR REPLACE FUNCTION public.reset_weekly_chips()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_reset_count integer;
BEGIN
  -- Reset free users to 1000 when below 100
  UPDATE user_portfolios
  SET total_chips = 1000, starting_chips = 1000, last_reset_at = now(), updated_at = now()
  WHERE (is_premium IS NULL OR is_premium = false) AND total_chips < 100;

  GET DIAGNOSTICS v_reset_count = ROW_COUNT;

  -- Reset premium users to 1500 when below 200
  UPDATE user_portfolios
  SET total_chips = 1500, starting_chips = 1500, last_reset_at = now(), updated_at = now()
  WHERE is_premium = true AND total_chips < 200;

  v_reset_count := v_reset_count + (SELECT COUNT(*) FROM user_portfolios WHERE is_premium = true AND last_reset_at = now());

  RETURN v_reset_count;
END;
$function$;

-- 5. Update get_huddle_leaderboard to use dynamic starting_chips for profit calc
CREATE OR REPLACE FUNCTION public.get_huddle_leaderboard(p_huddle_id uuid)
 RETURNS TABLE(user_id uuid, display_name text, username text, avatar_url text, total_chips integer, total_bets integer, total_wins integer, total_losses integer, profit integer, rank bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  SELECT
    up.user_id,
    p.display_name,
    p.username,
    p.avatar_url,
    up.total_chips,
    up.total_bets,
    up.total_wins,
    up.total_losses,
    (up.total_chips - COALESCE(up.starting_chips, 1000)) AS profit,
    rank() OVER (ORDER BY (up.total_chips - COALESCE(up.starting_chips, 1000)) DESC, up.total_wins DESC) AS rank
  FROM user_portfolios up
  JOIN profiles p ON p.user_id = up.user_id AND p.status != 'banned'
  WHERE up.user_id IN (
    SELECT hm.user_id FROM huddle_members hm WHERE hm.huddle_id = p_huddle_id
  )
  AND up.total_bets > 0
  ORDER BY rank;
END;
$function$;
