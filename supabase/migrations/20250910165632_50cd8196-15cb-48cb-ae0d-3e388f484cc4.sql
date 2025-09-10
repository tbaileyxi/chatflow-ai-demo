-- Fix the leaderboard zero scores issue by updating the validation function
-- to allow system updates to set is_correct values

CREATE OR REPLACE FUNCTION public.validate_pickem_pick_not_locked()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  g_start timestamptz;
  g_status text;
BEGIN
  -- Allow system updates to is_correct field (this happens when games finish)
  IF TG_OP = 'UPDATE' AND OLD.picked_team = NEW.picked_team AND OLD.is_correct IS DISTINCT FROM NEW.is_correct THEN
    RETURN NEW;
  END IF;

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
$function$;

-- Re-run scoring to fix current Week 1 data
UPDATE public.pickem_picks pp
SET is_correct = CASE 
  WHEN pg.winning_team IS NOT NULL THEN (pp.picked_team = pg.winning_team)
  ELSE NULL
END
FROM public.pickem_games pg
WHERE pp.game_id = pg.id
  AND pg.status = 'final'
  AND pg.winning_team IS NOT NULL;

-- Recalculate all entry scores
UPDATE public.pickem_entries pe
SET total_score = (
  SELECT COUNT(*)
  FROM public.pickem_picks pp2
  WHERE pp2.entry_id = pe.id
  AND pp2.is_correct = TRUE
);