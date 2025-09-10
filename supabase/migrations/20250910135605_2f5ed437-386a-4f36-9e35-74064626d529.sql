-- Fix security issues in the newly created functions by setting search_path

-- Update the first function
CREATE OR REPLACE FUNCTION public.update_picks_on_game_result()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
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
$$;

-- Update the second function
CREATE OR REPLACE FUNCTION public.check_and_close_pickem_instances()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
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
$$;