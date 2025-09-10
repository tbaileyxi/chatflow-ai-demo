-- Drop and recreate the validation trigger to allow system updates during game scoring
DROP TRIGGER IF EXISTS validate_pickem_pick_lock_trigger ON pickem_picks;

-- Update the validation function to allow system updates to is_correct field
CREATE OR REPLACE FUNCTION public.validate_pickem_pick_not_locked()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  g_start timestamptz;
  g_status text;
BEGIN
  -- Allow system updates to is_correct field during scoring (this happens when games finish)
  IF TG_OP = 'UPDATE' AND OLD.picked_team = NEW.picked_team AND OLD.is_correct IS DISTINCT FROM NEW.is_correct THEN
    RETURN NEW;
  END IF;

  -- For user changes to picks, check if game is locked
  IF TG_OP = 'UPDATE' AND OLD.picked_team IS DISTINCT FROM NEW.picked_team THEN
    SELECT start_time, status INTO g_start, g_status
    FROM public.pickem_games WHERE id = NEW.game_id;

    IF g_start IS NULL THEN
      RAISE EXCEPTION 'Game not found for pick validation';
    END IF;

    IF (now() >= g_start) OR (g_status IN ('in_progress','final')) THEN
      RAISE EXCEPTION 'Picks are locked for this game';
    END IF;
  END IF;

  -- For new picks, check if game is locked
  IF TG_OP = 'INSERT' THEN
    SELECT start_time, status INTO g_start, g_status
    FROM public.pickem_games WHERE id = NEW.game_id;

    IF g_start IS NULL THEN
      RAISE EXCEPTION 'Game not found for pick validation';
    END IF;

    IF (now() >= g_start) OR (g_status IN ('in_progress','final')) THEN
      RAISE EXCEPTION 'Picks are locked for this game';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER validate_pickem_pick_lock_trigger
  BEFORE INSERT OR UPDATE ON pickem_picks
  FOR EACH ROW
  EXECUTE FUNCTION validate_pickem_pick_not_locked();

-- Now update the games to test scoring
UPDATE pickem_games 
SET status = 'final', winning_team = 'Green Bay Packers'
WHERE espn_game_id = '401772936';

UPDATE pickem_games 
SET status = 'final', winning_team = 'Cincinnati Bengals'  
WHERE espn_game_id = '401772725';