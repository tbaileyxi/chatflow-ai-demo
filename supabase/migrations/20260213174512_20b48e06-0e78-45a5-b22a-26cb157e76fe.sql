
-- ============================================
-- Kalshi Shadow Market System - Database Schema
-- ============================================

-- 1. kalshi_markets - Cached Kalshi market data
CREATE TABLE public.kalshi_markets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kalshi_ticker text UNIQUE NOT NULL,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  huddle_id uuid REFERENCES public.huddles(id) ON DELETE SET NULL,
  question text NOT NULL,
  current_yes_price integer DEFAULT 50 CHECK (current_yes_price >= 0 AND current_yes_price <= 100),
  market_type text DEFAULT 'spread',
  event_start_time timestamptz,
  is_resolved boolean DEFAULT false,
  resolution text,
  resolved_at timestamptz,
  kalshi_event_ticker text,
  posted_at timestamptz,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. shadow_bets - User predictions
CREATE TABLE public.shadow_bets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  market_id uuid NOT NULL REFERENCES public.kalshi_markets(id) ON DELETE CASCADE,
  huddle_id uuid NOT NULL REFERENCES public.huddles(id) ON DELETE CASCADE,
  position text NOT NULL CHECK (position IN ('YES', 'NO')),
  chips_risked integer NOT NULL CHECK (chips_risked > 0),
  potential_payout integer NOT NULL DEFAULT 100,
  placed_at timestamptz DEFAULT now(),
  is_settled boolean DEFAULT false,
  won boolean,
  chips_won integer DEFAULT 0,
  UNIQUE(user_id, market_id)
);

-- 3. user_portfolios - Chip balances
CREATE TABLE public.user_portfolios (
  user_id uuid NOT NULL PRIMARY KEY,
  total_chips integer DEFAULT 1000,
  total_bets integer DEFAULT 0,
  total_wins integer DEFAULT 0,
  total_losses integer DEFAULT 0,
  last_reset_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX idx_kalshi_markets_team ON public.kalshi_markets(team_id);
CREATE INDEX idx_kalshi_markets_resolved ON public.kalshi_markets(is_resolved, event_start_time);
CREATE INDEX idx_kalshi_markets_posted ON public.kalshi_markets(posted_at);
CREATE INDEX idx_shadow_bets_user ON public.shadow_bets(user_id);
CREATE INDEX idx_shadow_bets_market ON public.shadow_bets(market_id);
CREATE INDEX idx_shadow_bets_huddle ON public.shadow_bets(huddle_id);
CREATE INDEX idx_shadow_bets_settled ON public.shadow_bets(is_settled);

-- ============================================
-- RLS Policies
-- ============================================

ALTER TABLE public.kalshi_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shadow_bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_portfolios ENABLE ROW LEVEL SECURITY;

-- kalshi_markets: all authenticated users can read
CREATE POLICY "Authenticated users can read markets"
  ON public.kalshi_markets FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- shadow_bets: users can read bets in their huddles
CREATE POLICY "Users can read bets in their huddles"
  ON public.shadow_bets FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND public.is_huddle_member(huddle_id, auth.uid())
  );

-- shadow_bets: users can insert their own bets
CREATE POLICY "Users can place their own bets"
  ON public.shadow_bets FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_huddle_member(huddle_id, auth.uid())
  );

-- user_portfolios: all authenticated can read (leaderboard)
CREATE POLICY "Authenticated users can read portfolios"
  ON public.user_portfolios FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- user_portfolios: users can insert their own
CREATE POLICY "Users can create own portfolio"
  ON public.user_portfolios FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- user_portfolios: users can update their own
CREATE POLICY "Users can update own portfolio"
  ON public.user_portfolios FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- Database Functions
-- ============================================

-- place_shadow_bet: atomic bet placement
CREATE OR REPLACE FUNCTION public.place_shadow_bet(
  p_market_id uuid,
  p_huddle_id uuid,
  p_position text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_yes_price integer;
  v_chips_cost integer;
  v_current_chips integer;
  v_market_resolved boolean;
  v_event_start timestamptz;
  v_bet_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Validate position
  IF p_position NOT IN ('YES', 'NO') THEN
    RAISE EXCEPTION 'Position must be YES or NO';
  END IF;

  -- Get market info
  SELECT current_yes_price, is_resolved, event_start_time
  INTO v_yes_price, v_market_resolved, v_event_start
  FROM kalshi_markets WHERE id = p_market_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Market not found';
  END IF;

  IF v_market_resolved THEN
    RAISE EXCEPTION 'Market already resolved';
  END IF;

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

  -- Check chips
  SELECT total_chips INTO v_current_chips
  FROM user_portfolios WHERE user_id = v_user_id FOR UPDATE;

  IF v_current_chips < v_chips_cost THEN
    RAISE EXCEPTION 'Not enough chips (you have %¢, need %¢)', v_current_chips, v_chips_cost;
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
$$;

-- settle_shadow_bets: settle all bets for a resolved market
CREATE OR REPLACE FUNCTION public.settle_shadow_bets(
  p_market_id uuid,
  p_resolution text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_settled_count integer := 0;
  v_bet RECORD;
BEGIN
  IF p_resolution NOT IN ('YES', 'NO') THEN
    RAISE EXCEPTION 'Resolution must be YES or NO';
  END IF;

  -- Mark market as resolved
  UPDATE kalshi_markets
  SET is_resolved = true, resolution = p_resolution, resolved_at = now(), updated_at = now()
  WHERE id = p_market_id AND is_resolved = false;

  -- Settle each bet
  FOR v_bet IN
    SELECT * FROM shadow_bets
    WHERE market_id = p_market_id AND is_settled = false
  LOOP
    IF v_bet.position = p_resolution THEN
      -- Winner: gets 100¢ payout
      UPDATE shadow_bets
      SET is_settled = true, won = true, chips_won = 100
      WHERE id = v_bet.id;

      UPDATE user_portfolios
      SET total_chips = total_chips + 100,
          total_wins = total_wins + 1,
          updated_at = now()
      WHERE user_id = v_bet.user_id;
    ELSE
      -- Loser: gets nothing (chips already deducted)
      UPDATE shadow_bets
      SET is_settled = true, won = false, chips_won = 0
      WHERE id = v_bet.id;

      UPDATE user_portfolios
      SET total_losses = total_losses + 1,
          updated_at = now()
      WHERE user_id = v_bet.user_id;
    END IF;

    v_settled_count := v_settled_count + 1;
  END LOOP;

  RETURN v_settled_count;
END;
$$;

-- get_huddle_leaderboard: ranked users by profit
CREATE OR REPLACE FUNCTION public.get_huddle_leaderboard(p_huddle_id uuid)
RETURNS TABLE(
  user_id uuid,
  display_name text,
  username text,
  avatar_url text,
  total_chips integer,
  total_bets integer,
  total_wins integer,
  total_losses integer,
  profit integer,
  rank bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    (up.total_chips - 1000) AS profit,
    rank() OVER (ORDER BY (up.total_chips - 1000) DESC, up.total_wins DESC) AS rank
  FROM user_portfolios up
  JOIN profiles p ON p.user_id = up.user_id AND p.status != 'banned'
  WHERE up.user_id IN (
    SELECT hm.user_id FROM huddle_members hm WHERE hm.huddle_id = p_huddle_id
  )
  AND up.total_bets > 0
  ORDER BY rank;
END;
$$;

-- reset_weekly_chips: reset users below 100 chips back to 1000
CREATE OR REPLACE FUNCTION public.reset_weekly_chips()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_reset_count integer;
BEGIN
  UPDATE user_portfolios
  SET total_chips = 1000, last_reset_at = now(), updated_at = now()
  WHERE total_chips < 100;

  GET DIAGNOSTICS v_reset_count = ROW_COUNT;
  RETURN v_reset_count;
END;
$$;

-- Trigger for updated_at on kalshi_markets
CREATE TRIGGER update_kalshi_markets_updated_at
  BEFORE UPDATE ON public.kalshi_markets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updated_at on user_portfolios
CREATE TRIGGER update_user_portfolios_updated_at
  BEFORE UPDATE ON public.user_portfolios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
