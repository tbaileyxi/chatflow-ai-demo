-- Fix the live game bot cron scheduling and huddle message user_id requirement
-- First, update the cron jobs to poll more frequently during typical game times

-- Remove existing live game bot cron job and recreate with better timing
SELECT cron.unschedule('live-game-bot-nfl') WHERE EXISTS(SELECT 1 FROM cron.job WHERE jobname = 'live-game-bot-nfl');
SELECT cron.unschedule('live-game-bot-college') WHERE EXISTS(SELECT 1 FROM cron.job WHERE jobname = 'live-game-bot-college');

-- Schedule NFL games polling every minute (high frequency for live games)
SELECT cron.schedule(
  'live-game-bot-nfl',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/live-game-bot',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlanV3eWV5cGlnZ3ZseWZsaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjU4MDgsImV4cCI6MjA2OTU0MTgwOH0.XHylH6wJuJjSZxU904oCZ33N0swsoRm6Tr2VjwI1Lz0"}'::jsonb,
    body := '{"league": "nfl", "trigger": "cron"}'::jsonb
  );
  $$
);

-- Schedule college football every 2 minutes (slightly less frequent)
SELECT cron.schedule(
  'live-game-bot-college',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/live-game-bot',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlanV3eWV5cGlnZ3ZseWZsaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjU4MDgsImV4cCI6MjA2OTU0MTgwOH0.XHylH6wJuJjSZxU904oCZ33N0swsoRm6Tr2VjwI1Lz0"}'::jsonb,
    body := '{"league": "college-football", "trigger": "cron"}'::jsonb
  );
  $$
);

-- Create a system user for bot messages
CREATE OR REPLACE FUNCTION get_or_create_system_user()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  system_user_id UUID;
BEGIN
  -- Check if system user exists
  SELECT user_id INTO system_user_id 
  FROM profiles 
  WHERE username = 'system_bot' 
  LIMIT 1;
  
  -- If not found, create a system user entry
  IF system_user_id IS NULL THEN
    system_user_id := gen_random_uuid();
    
    INSERT INTO profiles (
      user_id,
      display_name,
      username,
      bio,
      status
    ) VALUES (
      system_user_id,
      'Game Bot',
      'system_bot',
      'Automated game updates',
      'active'
    );
  END IF;
  
  RETURN system_user_id;
END;
$$;

-- Enable realtime for huddle_messages table
ALTER TABLE huddle_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE huddle_messages;