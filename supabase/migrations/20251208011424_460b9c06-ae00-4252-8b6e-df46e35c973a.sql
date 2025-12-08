CREATE OR REPLACE FUNCTION public.notify_coach_mention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  settings_record RECORD;
BEGIN
  -- Skip if this is already a bot message (prevents self-triggering and welcome message trigger)
  IF NEW.is_bot_message = TRUE THEN
    RETURN NEW;
  END IF;

  -- Only process if message contains @coach (case-insensitive)
  IF NEW.content ILIKE '%@coach%' THEN
    -- Check if bot is enabled for this huddle
    SELECT * INTO settings_record 
    FROM huddle_chatbot_settings 
    WHERE huddle_id = NEW.huddle_id;
    
    -- If settings exist and bot is enabled, call the edge function
    IF settings_record.is_enabled IS TRUE THEN
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
$function$;