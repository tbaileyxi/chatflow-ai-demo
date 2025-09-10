-- Update the pickem_leaderboard view to handle display names properly
DROP VIEW IF EXISTS public.pickem_leaderboard;

CREATE VIEW public.pickem_leaderboard AS
SELECT 
  pe.instance_id,
  pe.user_id,
  pe.total_score,
  RANK() OVER (PARTITION BY pe.instance_id ORDER BY pe.total_score DESC, pe.created_at ASC) as rank,
  COALESCE(NULLIF(TRIM(p.display_name), ''), NULLIF(TRIM(p.username), ''), 'Anonymous') as display_name,
  p.username
FROM public.pickem_entries pe
JOIN public.profiles p ON p.user_id = pe.user_id
ORDER BY pe.instance_id, rank;

-- Ensure all necessary triggers are active for automatic score updates
CREATE OR REPLACE FUNCTION public.update_picks_and_scores_after_game_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS update_picks_and_scores_after_game_update ON public.pickem_games;
CREATE TRIGGER update_picks_and_scores_after_game_update
  AFTER UPDATE ON public.pickem_games
  FOR EACH ROW
  EXECUTE FUNCTION public.update_picks_and_scores_after_game_update();

-- Ensure entry score update trigger exists
DROP TRIGGER IF EXISTS update_entry_score_after_pick ON public.pickem_picks;
CREATE TRIGGER update_entry_score_after_pick
  AFTER INSERT OR UPDATE ON public.pickem_picks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_entry_score_after_pick();