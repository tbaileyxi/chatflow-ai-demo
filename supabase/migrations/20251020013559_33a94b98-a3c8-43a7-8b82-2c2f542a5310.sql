-- Enable required extensions for cron scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedule existing jobs if they exist (ignore errors if they don't exist)
DO $$ 
BEGIN
  PERFORM cron.unschedule('fetch-highlights-cron');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$ 
BEGIN
  PERFORM cron.unschedule('pickem-scoring-cron');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$ 
BEGIN
  PERFORM cron.unschedule('sync-highlightly-teams-cron');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Schedule fetch-highlights to run every 5 minutes
SELECT cron.schedule(
  'fetch-highlights-cron',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url:='https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/fetch-highlights',
    headers:='{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlanV3eWV5cGlnZ3ZseWZsaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjU4MDgsImV4cCI6MjA2OTU0MTgwOH0.XHylH6wJuJjSZxU904oCZ33N0swsoRm6Tr2VjwI1Lz0"}'::jsonb
  ) as request_id;
  $$
);

-- Schedule pickem-scoring to run every 10 minutes
SELECT cron.schedule(
  'pickem-scoring-cron',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url:='https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/pickem-scoring',
    headers:='{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlanV3eWV5cGlnZ3ZseWZsaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjU4MDgsImV4cCI6MjA2OTU0MTgwOH0.XHylH6wJuJjSZxU904oCZ33N0swsoRm6Tr2VjwI1Lz0"}'::jsonb
  ) as request_id;
  $$
);

-- Schedule sync-highlightly-teams to run daily at 2 AM
SELECT cron.schedule(
  'sync-highlightly-teams-cron',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url:='https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/sync-highlightly-teams',
    headers:='{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlanV3eWV5cGlnZ3ZseWZsaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjU4MDgsImV4cCI6MjA2OTU0MTgwOH0.XHylH6wJuJjSZxU904oCZ33N0swsoRm6Tr2VjwI1Lz0"}'::jsonb
  ) as request_id;
  $$
);