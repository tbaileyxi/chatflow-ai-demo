-- Separate fast scoreboard sync from slower bot/news posting.
-- Scoreboard: near-real-time during game hours.
-- Bot pulse: scheduled often enough to catch pregame/live mode, but pulse-drop throttles actual posts.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'games'
      AND constraint_name = 'games_status_check'
  ) THEN
    ALTER TABLE public.games DROP CONSTRAINT games_status_check;
  END IF;

  ALTER TABLE public.games
    ADD CONSTRAINT games_status_check
    CHECK (status IN ('scheduled', 'live', 'in_progress', 'final'));
END $$;

DO $$
DECLARE
  job_name text;
BEGIN
  FOREACH job_name IN ARRAY ARRAY[
    'live-game-bot-poll',
    'live-game-bot-polling',
    'live-game-bot-updates',
    'live-game-bot-nfl',
    'live-game-bot-cfb',
    'live-game-bot-college',
    'sync-live-scores-peak',
    'sync-live-scores-afternoon',
    'sync-live-scores-offpeak',
    'pulse-scheduler-every-10min',
    'pulse-scheduler-active',
    'pulse-scheduler-offhours'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = job_name) THEN
      PERFORM cron.unschedule(job_name);
    END IF;
  END LOOP;
END $$;

-- Noon-1am ET-ish coverage: MLB day games, NBA/NHL nights, football windows.
SELECT cron.schedule(
  'sync-live-scores-game-hours-30s',
  '* 16-23,0-5 * * *',
  $$
  SELECT net.http_post(
    url := 'https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/sync-live-scores',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlanV3eWV5cGlnZ3ZseWZsaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjU4MDgsImV4cCI6MjA2OTU0MTgwOH0.XHylH6wJuJjSZxU904oCZ33N0swsoRm6Tr2VjwI1Lz0"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  SELECT pg_sleep(30);
  SELECT net.http_post(
    url := 'https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/sync-live-scores',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlanV3eWV5cGlnZ3ZseWZsaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjU4MDgsImV4cCI6MjA2OTU0MTgwOH0.XHylH6wJuJjSZxU904oCZ33N0swsoRm6Tr2VjwI1Lz0"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Overnight/off-hours: enough to catch late finals and early schedule changes.
SELECT cron.schedule(
  'sync-live-scores-off-hours-5m',
  '*/5 6-15 * * *',
  $$
  SELECT net.http_post(
    url := 'https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/sync-live-scores',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlanV3eWV5cGlnZ3ZseWZsaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjU4MDgsImV4cCI6MjA2OTU0MTgwOH0.XHylH6wJuJjSZxU904oCZ33N0swsoRm6Tr2VjwI1Lz0"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Game/day pulse runner. The function decides which huddles are in pregame/live mode;
-- pulse-drop then caps actual bot posts to avoid score spam.
SELECT cron.schedule(
  'pulse-scheduler-game-hours-5m',
  '*/5 16-23,0-5 * * *',
  $$
  SELECT net.http_post(
    url := 'https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/pulse-scheduler',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlanV3eWV5cGlnZ3ZseWZsaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjU4MDgsImV4cCI6MjA2OTU0MTgwOH0.XHylH6wJuJjSZxU904oCZ33N0swsoRm6Tr2VjwI1Lz0"}'::jsonb,
    body := concat('{"time": "', now(), '"}')::jsonb
  ) AS request_id;
  $$
);

-- Daytime/off-hours news pass. Actual posting remains throttled to a few useful drops/day.
SELECT cron.schedule(
  'pulse-scheduler-daytime-hourly',
  '0 6-15 * * *',
  $$
  SELECT net.http_post(
    url := 'https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/pulse-scheduler',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlanV3eWV5cGlnZ3ZseWZsaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjU4MDgsImV4cCI6MjA2OTU0MTgwOH0.XHylH6wJuJjSZxU904oCZ33N0swsoRm6Tr2VjwI1Lz0"}'::jsonb,
    body := concat('{"time": "', now(), '"}')::jsonb
  ) AS request_id;
  $$
);
