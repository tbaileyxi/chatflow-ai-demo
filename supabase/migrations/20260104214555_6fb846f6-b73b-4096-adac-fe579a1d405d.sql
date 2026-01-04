-- =====================================================
-- LIVE CONTEXT ENGINE: Database Schema
-- =====================================================

-- 1. Create games table (auto-managed from Odds API)
CREATE TABLE IF NOT EXISTS public.games (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  odds_game_id TEXT UNIQUE NOT NULL,
  sport_key TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'final')),
  home_team_id UUID REFERENCES public.teams(id),
  away_team_id UUID REFERENCES public.teams(id),
  home_score INTEGER,
  away_score INTEGER,
  period TEXT,
  clock TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_games_status ON public.games(status);
CREATE INDEX IF NOT EXISTS idx_games_start_time ON public.games(start_time);
CREATE INDEX IF NOT EXISTS idx_games_home_team ON public.games(home_team_id);
CREATE INDEX IF NOT EXISTS idx_games_away_team ON public.games(away_team_id);
CREATE INDEX IF NOT EXISTS idx_games_odds_game_id ON public.games(odds_game_id);

-- 2. Create teams_live_state table (computed state per team)
CREATE TABLE IF NOT EXISTS public.teams_live_state (
  team_id UUID PRIMARY KEY REFERENCES public.teams(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'normal' CHECK (state IN ('normal', 'live', 'cooldown')),
  active_game_id UUID REFERENCES public.games(id) ON DELETE SET NULL,
  active_opponent_team_id UUID REFERENCES public.teams(id),
  home_score INTEGER,
  away_score INTEGER,
  is_home_team BOOLEAN DEFAULT true,
  cooldown_ends_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teams_live_state_state ON public.teams_live_state(state);

-- 3. Add columns to live_events to convert to special_events concept
-- (keeping table name for backward compatibility but adding new fields)
ALTER TABLE public.live_events 
  ADD COLUMN IF NOT EXISTS is_special_event BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS linked_team_ids UUID[];

-- 4. RLS Policies

-- Games table: Anyone can read, service role can manage
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view games" ON public.games
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage games" ON public.games
  FOR ALL USING (true);

-- Teams live state: Anyone can read, service role can manage
ALTER TABLE public.teams_live_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view team live state" ON public.teams_live_state
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage team live state" ON public.teams_live_state
  FOR ALL USING (true);

-- 5. Create function to get room live context
CREATE OR REPLACE FUNCTION public.get_room_live_context(p_room_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id UUID;
  v_event_id UUID;
  v_live_state RECORD;
  v_game RECORD;
  v_event RECORD;
  v_result JSONB;
BEGIN
  -- Get huddle info (could be team huddle or event room)
  SELECT team_id, event_id INTO v_team_id, v_event_id
  FROM huddles
  WHERE id = p_room_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('mode', 'normal', 'game', NULL, 'special_event', NULL);
  END IF;
  
  -- Check team live state first
  IF v_team_id IS NOT NULL THEN
    SELECT * INTO v_live_state
    FROM teams_live_state
    WHERE team_id = v_team_id;
    
    IF v_live_state.state IN ('live', 'cooldown') THEN
      -- Get game details if available
      IF v_live_state.active_game_id IS NOT NULL THEN
        SELECT g.*, 
               ht.name as home_team_name, ht.logo_url as home_team_logo,
               at.name as away_team_name, at.logo_url as away_team_logo
        INTO v_game
        FROM games g
        LEFT JOIN teams ht ON g.home_team_id = ht.id
        LEFT JOIN teams at ON g.away_team_id = at.id
        WHERE g.id = v_live_state.active_game_id;
      END IF;
      
      RETURN jsonb_build_object(
        'mode', v_live_state.state,
        'game', CASE WHEN v_game IS NOT NULL THEN jsonb_build_object(
          'id', v_game.id,
          'home_team', v_game.home_team_name,
          'away_team', v_game.away_team_name,
          'home_team_logo', v_game.home_team_logo,
          'away_team_logo', v_game.away_team_logo,
          'home_score', v_game.home_score,
          'away_score', v_game.away_score,
          'period', v_game.period,
          'clock', v_game.clock,
          'status', v_game.status
        ) ELSE NULL END,
        'special_event', NULL,
        'is_home_team', v_live_state.is_home_team,
        'opponent_team_id', v_live_state.active_opponent_team_id
      );
    END IF;
  END IF;
  
  -- Check for special event (either by event_id or linked_team_ids)
  IF v_event_id IS NOT NULL THEN
    SELECT * INTO v_event
    FROM live_events
    WHERE id = v_event_id AND status = 'live';
  ELSIF v_team_id IS NOT NULL THEN
    SELECT * INTO v_event
    FROM live_events
    WHERE v_team_id = ANY(linked_team_ids) AND status = 'live'
    LIMIT 1;
  END IF;
  
  IF v_event IS NOT NULL THEN
    RETURN jsonb_build_object(
      'mode', 'live',
      'game', NULL,
      'special_event', jsonb_build_object(
        'id', v_event.id,
        'name', v_event.name,
        'subtitle', v_event.subtitle,
        'network', v_event.network
      )
    );
  END IF;
  
  -- Default: normal mode
  RETURN jsonb_build_object('mode', 'normal', 'game', NULL, 'special_event', NULL);
END;
$$;