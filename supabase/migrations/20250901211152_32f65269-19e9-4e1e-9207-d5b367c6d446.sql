
-- 1) Types
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pickem_league') THEN
    CREATE TYPE public.pickem_league AS ENUM ('nfl', 'ncaaf');
  END IF;
END$$;

-- 2) Core tables
CREATE TABLE IF NOT EXISTS public.pickem_weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league public.pickem_league NOT NULL,
  season_year integer NOT NULL,
  week_number integer NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (league, season_year, week_number)
);

CREATE TABLE IF NOT EXISTS public.pickem_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id uuid NOT NULL REFERENCES public.pickem_weeks(id) ON DELETE CASCADE,
  espn_game_id text NOT NULL,
  home_team text NOT NULL,
  away_team text NOT NULL,
  start_time timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled', -- scheduled | in_progress | final | postponed
  winning_team text NULL,                   -- must match one of home_team/away_team when final
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (week_id, espn_game_id)
);

CREATE TABLE IF NOT EXISTS public.pickem_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  huddle_id uuid NOT NULL REFERENCES public.huddles(id) ON DELETE CASCADE,
  week_id uuid NOT NULL REFERENCES public.pickem_weeks(id) ON DELETE CASCADE,
  title text,
  created_by uuid NOT NULL, -- profile user_id (no FK to auth)
  status text NOT NULL DEFAULT 'open', -- open | locked | final
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pickem_instance_games (
  instance_id uuid NOT NULL REFERENCES public.pickem_instances(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES public.pickem_games(id) ON DELETE CASCADE,
  PRIMARY KEY (instance_id, game_id)
);

CREATE TABLE IF NOT EXISTS public.pickem_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.pickem_instances(id) ON DELETE CASCADE,
  user_id uuid NOT NULL, -- profile user_id
  total_score integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instance_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.pickem_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.pickem_entries(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES public.pickem_games(id) ON DELETE CASCADE,
  picked_team text NOT NULL,     -- must equal home_team or away_team
  is_correct boolean NULL,       -- set when game is final
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entry_id, game_id)
);

-- 3) Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pickem_games_week_id ON public.pickem_games(week_id);
CREATE INDEX IF NOT EXISTS idx_pickem_instances_huddle_id ON public.pickem_instances(huddle_id);
CREATE INDEX IF NOT EXISTS idx_pickem_instances_week_id ON public.pickem_instances(week_id);
CREATE INDEX IF NOT EXISTS idx_pickem_entries_instance_id ON public.pickem_entries(instance_id);
CREATE INDEX IF NOT EXISTS idx_pickem_entries_user_id ON public.pickem_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_pickem_picks_entry_id ON public.pickem_picks(entry_id);
CREATE INDEX IF NOT EXISTS idx_pickem_picks_game_id ON public.pickem_picks(game_id);
CREATE INDEX IF NOT EXISTS idx_pickem_games_start_time ON public.pickem_games(start_time);

-- 4) Updated_at triggers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at_pickem_weeks'
  ) THEN
    CREATE TRIGGER trg_set_updated_at_pickem_weeks
      BEFORE UPDATE ON public.pickem_weeks
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at_pickem_games'
  ) THEN
    CREATE TRIGGER trg_set_updated_at_pickem_games
      BEFORE UPDATE ON public.pickem_games
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at_pickem_instances'
  ) THEN
    CREATE TRIGGER trg_set_updated_at_pickem_instances
      BEFORE UPDATE ON public.pickem_instances
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at_pickem_entries'
  ) THEN
    CREATE TRIGGER trg_set_updated_at_pickem_entries
      BEFORE UPDATE ON public.pickem_entries
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at_pickem_picks'
  ) THEN
    CREATE TRIGGER trg_set_updated_at_pickem_picks
      BEFORE UPDATE ON public.pickem_picks
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

-- 5) Lock validation: prevent picks after kickoff (use trigger, not CHECK)
CREATE OR REPLACE FUNCTION public.validate_pickem_pick_not_locked()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  g_start timestamptz;
  g_status text;
BEGIN
  SELECT start_time, status INTO g_start, g_status
  FROM public.pickem_games WHERE id = COALESCE(NEW.game_id, OLD.game_id);

  IF g_start IS NULL THEN
    RAISE EXCEPTION 'Game not found for pick validation';
  END IF;

  IF (now() >= g_start) OR (g_status IN ('in_progress','final')) THEN
    RAISE EXCEPTION 'Picks are locked for this game';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_pick_before_write ON public.pickem_picks;
CREATE TRIGGER trg_validate_pick_before_write
  BEFORE INSERT OR UPDATE ON public.pickem_picks
  FOR EACH ROW EXECUTE FUNCTION public.validate_pickem_pick_not_locked();

-- 6) Scoring helpers
CREATE OR REPLACE FUNCTION public.recalculate_entry_total(_entry_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.pickem_entries e
  SET total_score = (
    SELECT COALESCE(COUNT(1),0)
    FROM public.pickem_picks p
    WHERE p.entry_id = _entry_id AND p.is_correct IS TRUE
  )
  WHERE e.id = _entry_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_picks_and_scores_after_game_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  rec RECORD;
BEGIN
  IF NEW.winning_team IS NOT NULL OR NEW.status = 'final' THEN
    -- Mark picks as correct/incorrect
    UPDATE public.pickem_picks
    SET is_correct = (picked_team = NEW.winning_team)
    WHERE game_id = NEW.id;

    -- Recalculate affected entries
    FOR rec IN
      SELECT DISTINCT entry_id FROM public.pickem_picks WHERE game_id = NEW.id
    LOOP
      PERFORM public.recalculate_entry_total(rec.entry_id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_score_on_game_update ON public.pickem_games;
CREATE TRIGGER trg_score_on_game_update
  AFTER UPDATE OF winning_team, status ON public.pickem_games
  FOR EACH ROW EXECUTE FUNCTION public.update_picks_and_scores_after_game_update();

CREATE OR REPLACE FUNCTION public.update_entry_score_after_pick()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.recalculate_entry_total(NEW.entry_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_score_after_pick ON public.pickem_picks;
CREATE TRIGGER trg_update_score_after_pick
  AFTER INSERT OR UPDATE OF is_correct ON public.pickem_picks
  FOR EACH ROW EXECUTE FUNCTION public.update_entry_score_after_pick();

-- 7) Enable RLS
ALTER TABLE public.pickem_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickem_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickem_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickem_instance_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickem_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickem_picks ENABLE ROW LEVEL SECURITY;

-- 8) Policies

-- Weeks/Games are readable by any signed-in user
DROP POLICY IF EXISTS "Pick'em weeks readable" ON public.pickem_weeks;
CREATE POLICY "Pick'em weeks readable"
  ON public.pickem_weeks FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Pick'em games readable" ON public.pickem_games;
CREATE POLICY "Pick'em games readable"
  ON public.pickem_games FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Instances: huddle owner manages; members can read
DROP POLICY IF EXISTS "Members can view instances" ON public.pickem_instances;
CREATE POLICY "Members can view instances"
  ON public.pickem_instances FOR SELECT
  USING (
    (EXISTS (
      SELECT 1 FROM public.huddle_members hm
      WHERE hm.huddle_id = pickem_instances.huddle_id AND hm.user_id = auth.uid()
    ))
    OR (EXISTS (
      SELECT 1 FROM public.huddles h
      WHERE h.id = pickem_instances.huddle_id AND h.owner_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "Owners can create instances" ON public.pickem_instances;
CREATE POLICY "Owners can create instances"
  ON public.pickem_instances FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.huddles h
      WHERE h.id = pickem_instances.huddle_id AND h.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can update instances" ON public.pickem_instances;
CREATE POLICY "Owners can update instances"
  ON public.pickem_instances FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.huddles h
      WHERE h.id = pickem_instances.huddle_id AND h.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can delete instances" ON public.pickem_instances;
CREATE POLICY "Owners can delete instances"
  ON public.pickem_instances FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.huddles h
      WHERE h.id = pickem_instances.huddle_id AND h.owner_id = auth.uid()
    )
  );

-- Instance games: members read; owners manage
DROP POLICY IF EXISTS "Members can view instance games" ON public.pickem_instance_games;
CREATE POLICY "Members can view instance games"
  ON public.pickem_instance_games FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.pickem_instances i
      JOIN public.huddle_members hm ON hm.huddle_id = i.huddle_id
      WHERE i.id = pickem_instance_games.instance_id AND hm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can manage instance games" ON public.pickem_instance_games;
CREATE POLICY "Owners can manage instance games"
  ON public.pickem_instance_games FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.pickem_instances i
      JOIN public.huddles h ON h.id = i.huddle_id
      WHERE i.id = pickem_instance_games.instance_id AND h.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.pickem_instances i
      JOIN public.huddles h ON h.id = i.huddle_id
      WHERE i.id = pickem_instance_games.instance_id AND h.owner_id = auth.uid()
    )
  );

-- Entries: members read; users manage their own entry
DROP POLICY IF EXISTS "Members can view entries" ON public.pickem_entries;
CREATE POLICY "Members can view entries"
  ON public.pickem_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.pickem_instances i
      JOIN public.huddle_members hm ON hm.huddle_id = i.huddle_id
      WHERE i.id = pickem_entries.instance_id AND hm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create their entry" ON public.pickem_entries;
CREATE POLICY "Users can create their entry"
  ON public.pickem_entries FOR INSERT
  WITH CHECK (
    (user_id = auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.pickem_instances i
      JOIN public.huddle_members hm ON hm.huddle_id = i.huddle_id
      WHERE i.id = pickem_entries.instance_id AND hm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their entry" ON public.pickem_entries;
CREATE POLICY "Users can update their entry"
  ON public.pickem_entries FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their entry" ON public.pickem_entries;
CREATE POLICY "Users can delete their entry"
  ON public.pickem_entries FOR DELETE
  USING (user_id = auth.uid());

-- Picks: own picks always visible; others visible after kickoff within same huddle
DROP POLICY IF EXISTS "View own picks" ON public.pickem_picks;
CREATE POLICY "View own picks"
  ON public.pickem_picks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.pickem_entries e
      WHERE e.id = pickem_picks.entry_id AND e.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "View picks after kickoff in huddle" ON public.pickem_picks;
CREATE POLICY "View picks after kickoff in huddle"
  ON public.pickem_picks FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.pickem_entries e
      JOIN public.pickem_instances i ON i.id = e.instance_id
      JOIN public.huddle_members hm ON hm.huddle_id = i.huddle_id
      JOIN public.pickem_games g ON g.id = pickem_picks.game_id
      WHERE e.id = pickem_picks.entry_id
        AND hm.user_id = auth.uid()
        AND g.start_time <= now()
    )
  );

DROP POLICY IF EXISTS "Users can insert their picks" ON public.pickem_picks;
CREATE POLICY "Users can insert their picks"
  ON public.pickem_picks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.pickem_entries e
      JOIN public.pickem_instances i ON i.id = e.instance_id
      JOIN public.huddle_members hm ON hm.huddle_id = i.huddle_id
      WHERE e.id = pickem_picks.entry_id
        AND e.user_id = auth.uid()
        AND hm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their picks" ON public.pickem_picks;
CREATE POLICY "Users can update their picks"
  ON public.pickem_picks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.pickem_entries e
      WHERE e.id = pickem_picks.entry_id AND e.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their picks" ON public.pickem_picks;
CREATE POLICY "Users can delete their picks"
  ON public.pickem_picks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.pickem_entries e
      WHERE e.id = pickem_picks.entry_id AND e.user_id = auth.uid()
    )
  );

-- 9) Views

CREATE OR REPLACE VIEW public.pickem_leaderboard AS
SELECT
  e.instance_id,
  e.user_id,
  p.display_name,
  p.username,
  e.total_score,
  DENSE_RANK() OVER (PARTITION BY e.instance_id ORDER BY e.total_score DESC, e.created_at ASC) AS rank
FROM public.pickem_entries e
LEFT JOIN public.profiles p ON p.user_id = e.user_id;

CREATE OR REPLACE VIEW public.pickem_user_totals AS
SELECT
  e.user_id,
  w.league,
  w.season_year,
  COUNT(DISTINCT e.id) AS entries_played,
  COALESCE(SUM(e.total_score),0) AS total_correct
FROM public.pickem_entries e
JOIN public.pickem_instances i ON i.id = e.instance_id
JOIN public.pickem_weeks w ON w.id = i.week_id
GROUP BY e.user_id, w.league, w.season_year;

-- Optional: make views readable to signed-in users (relies on underlying RLS)
-- No separate RLS needed for views; they respect base table RLS.

