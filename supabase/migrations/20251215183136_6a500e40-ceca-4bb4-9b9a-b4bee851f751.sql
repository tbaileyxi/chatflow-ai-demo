-- Fades table (individual bets posted by users)
CREATE TABLE public.fades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  huddle_id UUID NOT NULL REFERENCES public.huddles(id) ON DELETE CASCADE,
  poster_id UUID NOT NULL,
  accepter_id UUID,
  
  -- Game reference
  game_id TEXT NOT NULL,
  game_commence_time TIMESTAMPTZ NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  sport TEXT NOT NULL DEFAULT 'basketball_ncaab',
  
  -- Fade details
  fade_type TEXT NOT NULL CHECK (fade_type IN ('over', 'under', 'spread', 'team_total')),
  line_value DECIMAL(5,2) NOT NULL,
  line_description TEXT NOT NULL,
  stake INTEGER NOT NULL DEFAULT 100 CHECK (stake IN (50, 100, 200)),
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'locked', 'expired', 'settled')),
  winner_id UUID,
  final_score_home INTEGER,
  final_score_away INTEGER,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ
);

-- Fade ledger (running tally between pairs of users in a huddle)
CREATE TABLE public.fade_ledgers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  huddle_id UUID NOT NULL REFERENCES public.huddles(id) ON DELETE CASCADE,
  user_a_id UUID NOT NULL,
  user_b_id UUID NOT NULL,
  
  net_points INTEGER NOT NULL DEFAULT 0,
  total_fades INTEGER NOT NULL DEFAULT 0,
  user_a_wins INTEGER NOT NULL DEFAULT 0,
  user_b_wins INTEGER NOT NULL DEFAULT 0,
  current_streak_a INTEGER NOT NULL DEFAULT 0,
  
  last_fade_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_fade_pair UNIQUE (huddle_id, user_a_id, user_b_id)
);

-- User season totals per huddle
CREATE TABLE public.fade_season_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  huddle_id UUID NOT NULL REFERENCES public.huddles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  season_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM now())::integer,
  
  total_points INTEGER NOT NULL DEFAULT 0,
  total_wins INTEGER NOT NULL DEFAULT 0,
  total_losses INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_fade_user_season UNIQUE (huddle_id, user_id, season_year)
);

-- Enable RLS
ALTER TABLE public.fades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fade_ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fade_season_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies for fades
CREATE POLICY "Members can view fades in their huddle"
ON public.fades FOR SELECT
USING (is_huddle_member(huddle_id, auth.uid()));

CREATE POLICY "Members can create fades"
ON public.fades FOR INSERT
WITH CHECK (
  auth.uid() = poster_id 
  AND is_huddle_member(huddle_id, auth.uid())
);

CREATE POLICY "Members can accept open fades"
ON public.fades FOR UPDATE
USING (
  status = 'open' 
  AND poster_id != auth.uid()
  AND is_huddle_member(huddle_id, auth.uid())
);

-- RLS Policies for fade_ledgers
CREATE POLICY "Members can view ledgers in their huddle"
ON public.fade_ledgers FOR SELECT
USING (is_huddle_member(huddle_id, auth.uid()));

CREATE POLICY "System can manage ledgers"
ON public.fade_ledgers FOR ALL
USING (true)
WITH CHECK (true);

-- RLS Policies for fade_season_stats
CREATE POLICY "Members can view stats in their huddle"
ON public.fade_season_stats FOR SELECT
USING (is_huddle_member(huddle_id, auth.uid()));

CREATE POLICY "System can manage stats"
ON public.fade_season_stats FOR ALL
USING (true)
WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_fades_huddle_id ON public.fades(huddle_id);
CREATE INDEX idx_fades_status ON public.fades(status);
CREATE INDEX idx_fades_game_id ON public.fades(game_id);
CREATE INDEX idx_fade_ledgers_huddle ON public.fade_ledgers(huddle_id);
CREATE INDEX idx_fade_stats_huddle ON public.fade_season_stats(huddle_id);