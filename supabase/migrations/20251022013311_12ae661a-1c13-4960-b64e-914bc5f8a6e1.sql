-- Enable pg_net extension for HTTP requests from database
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create function to call team-chatbot edge function when @coach is mentioned
CREATE OR REPLACE FUNCTION notify_coach_mention()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  settings_record RECORD;
  function_url TEXT;
BEGIN
  -- Only process if message contains @coach (case-insensitive)
  IF NEW.content ILIKE '%@coach%' THEN
    -- Check if bot is enabled for this huddle
    SELECT * INTO settings_record 
    FROM huddle_chatbot_settings 
    WHERE huddle_id = NEW.huddle_id;
    
    -- If settings exist and bot is enabled, call the edge function
    IF settings_record.is_enabled IS TRUE THEN
      -- Construct the edge function URL
      function_url := current_setting('app.supabase_url', true) || '/functions/v1/team-chatbot';
      
      -- Call edge function asynchronously using pg_net
      PERFORM net.http_post(
        url := function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
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

-- Create trigger on huddle_messages to detect @coach mentions
CREATE TRIGGER on_coach_mention
  AFTER INSERT ON huddle_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_coach_mention();

-- Set app settings for the function (these will be set by Supabase automatically in production)
-- These are just placeholders for local development
DO $$
BEGIN
  IF current_setting('app.supabase_url', true) IS NULL THEN
    PERFORM set_config('app.supabase_url', 'https://dejuwyeypiggvlyfliap.supabase.co', false);
  END IF;
END $$;