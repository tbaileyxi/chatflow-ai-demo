-- Create triggers to automatically update pick correctness and leaderboard scores

-- Function to update picks when a game's winning team changes
CREATE OR REPLACE FUNCTION public.update_picks_on_game_result()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if winning_team or status changed
  IF (OLD.winning_team IS DISTINCT FROM NEW.winning_team) OR (OLD.status IS DISTINCT FROM NEW.status) THEN
    -- Update pick correctness for this game
    UPDATE public.pickem_picks pp
    SET is_correct = CASE 
      WHEN NEW.winning_team IS NOT NULL THEN (pp.picked_team = NEW.winning_team)
      ELSE NULL
    END
    WHERE pp.game_id = NEW.id;
    
    -- Recalculate scores for all affected entries
    UPDATE public.pickem_entries pe
    SET total_score = (
      SELECT COUNT(*)
      FROM public.pickem_picks pp2
      WHERE pp2.entry_id = pe.id
      AND pp2.is_correct = TRUE
    )
    WHERE pe.id IN (
      SELECT DISTINCT pp.entry_id
      FROM public.pickem_picks pp
      WHERE pp.game_id = NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS trigger_update_picks_on_game_result ON public.pickem_games;
CREATE TRIGGER trigger_update_picks_on_game_result
  AFTER UPDATE ON public.pickem_games
  FOR EACH ROW
  EXECUTE FUNCTION public.update_picks_on_game_result();

-- Function to close pick'em instances when all games are final
CREATE OR REPLACE FUNCTION public.check_and_close_pickem_instances()
RETURNS TRIGGER AS $$
DECLARE
  instance_record RECORD;
BEGIN
  -- Check all instances that have this game
  FOR instance_record IN 
    SELECT DISTINCT pi.id, pi.huddle_id
    FROM public.pickem_instances pi
    JOIN public.pickem_instance_games pig ON pig.instance_id = pi.id
    WHERE pig.game_id = NEW.id
    AND pi.status = 'open'
  LOOP
    -- Check if all games in this instance are final
    IF NOT EXISTS (
      SELECT 1
      FROM public.pickem_instance_games pig2
      JOIN public.pickem_games pg ON pg.id = pig2.game_id
      WHERE pig2.instance_id = instance_record.id
      AND pg.status != 'final'
    ) THEN
      -- All games are final, close the instance
      UPDATE public.pickem_instances
      SET status = 'closed'
      WHERE id = instance_record.id;
      
      -- Post leaderboard message to huddle
      INSERT INTO public.huddle_messages (
        huddle_id,
        user_id,
        content,
        message_type,
        embed_code,
        is_bot_message
      ) VALUES (
        instance_record.huddle_id,
        (SELECT get_or_create_system_user()),
        'Pick ''em results are in! Check out the leaderboard:',
        'pickem_leaderboard',
        'pickem_leaderboard:' || instance_record.id,
        true
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS trigger_check_and_close_pickem_instances ON public.pickem_games;
CREATE TRIGGER trigger_check_and_close_pickem_instances
  AFTER UPDATE ON public.pickem_games
  FOR EACH ROW
  WHEN (NEW.status = 'final' AND OLD.status != 'final')
  EXECUTE FUNCTION public.check_and_close_pickem_instances();