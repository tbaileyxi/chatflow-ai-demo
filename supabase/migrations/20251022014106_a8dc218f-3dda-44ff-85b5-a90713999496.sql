-- Fix notify_coach_mention function to use hardcoded URL
DROP TRIGGER IF EXISTS on_coach_mention ON huddle_messages;
DROP FUNCTION IF EXISTS notify_coach_mention();

-- Recreate function with hardcoded Supabase URL
CREATE OR REPLACE FUNCTION public.notify_coach_mention()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  settings_record RECORD;
BEGIN
  -- Only process if message contains @coach (case-insensitive)
  IF NEW.content ILIKE '%@coach%' THEN
    -- Check if bot is enabled for this huddle
    SELECT * INTO settings_record 
    FROM huddle_chatbot_settings 
    WHERE huddle_id = NEW.huddle_id;
    
    -- If settings exist and bot is enabled, call the edge function
    IF settings_record.is_enabled IS TRUE THEN
      -- Call edge function asynchronously using pg_net with hardcoded URL
      PERFORM net.http_post(
        url := 'https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/team-chatbot',
        headers := jsonb_build_object(
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
          'message_id', NEW.id,
          'huddle_id', NEW.huddle_id,
          'content', NEW.content
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER on_coach_mention
  AFTER INSERT ON huddle_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_coach_mention();