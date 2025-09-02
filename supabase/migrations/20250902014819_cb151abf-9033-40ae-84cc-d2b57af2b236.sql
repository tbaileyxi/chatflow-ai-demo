-- Enable scheduled functions for live game updates
-- This ensures the live-game-bot function runs every 2 minutes during game days

-- First, let's check if we need to create a scheduled function for live-game-bot
-- The function should run every 2 minutes to catch live game updates

-- Add a cron job for live game bot (every 2 minutes)
SELECT cron.schedule(
  'live-game-bot-updates',
  '*/2 * * * *', -- Every 2 minutes
  $$
  SELECT
    net.http_post(
      url := 'https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/live-game-bot',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key', true) || '"}'::jsonb,
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- Add a cron job for processing scheduled broadcasts (every 5 minutes)
SELECT cron.schedule(
  'process-scheduled-broadcasts',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT
    net.http_post(
      url := 'https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/process-scheduled-broadcasts',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key', true) || '"}'::jsonb,
      body := '{}'::jsonb
    ) as request_id;
  $$
);