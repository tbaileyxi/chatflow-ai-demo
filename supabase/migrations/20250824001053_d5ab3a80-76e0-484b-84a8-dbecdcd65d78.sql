-- Enable required extensions for scheduling HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Unschedule existing jobs if present (idempotent)
SELECT cron.unschedule('live-game-bot-nfl');
SELECT cron.unschedule('live-game-bot-cfb');

-- Schedule NFL polling every minute
SELECT
  cron.schedule(
    'live-game-bot-nfl',
    '* * * * *',
    $$
    SELECT net.http_post(
      url := 'https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/live-game-bot',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := '{}'::jsonb
    );
    $$
  );

-- Schedule College Football polling every 2 minutes
SELECT
  cron.schedule(
    'live-game-bot-cfb',
    '*/2 * * * *',
    $$
    SELECT net.http_post(
      url := 'https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/live-game-bot',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := '{"league":"college-football"}'::jsonb
    );
    $$
  );