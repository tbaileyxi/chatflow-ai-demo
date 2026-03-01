-- Smart cron for ESPN live score sync
-- Peak game hours: 6pm–midnight ET ≈ 22-05 UTC (covers EST+EDT)
-- Run every 60 seconds during peak hours
SELECT cron.schedule(
  'sync-live-scores-peak',
  '* 22-23,0-5 * * *',
  $$
  SELECT net.http_post(
    url := 'https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/sync-live-scores',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlanV3eWV5cGlnZ3ZseWZsaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjU4MDgsImV4cCI6MjA2OTU0MTgwOH0.XHylH6wJuJjSZxU904oCZ33N0swsoRm6Tr2VjwI1Lz0"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Afternoon games: noon–6pm ET ≈ 16-22 UTC
-- Run every 2 minutes (college football, early NBA, matinees)
SELECT cron.schedule(
  'sync-live-scores-afternoon',
  '*/2 16-21 * * *',
  $$
  SELECT net.http_post(
    url := 'https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/sync-live-scores',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlanV3eWV5cGlnZ3ZseWZsaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjU4MDgsImV4cCI6MjA2OTU0MTgwOH0.XHylH6wJuJjSZxU904oCZ33N0swsoRm6Tr2VjwI1Lz0"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Off-peak: midnight–noon ET ≈ 6-16 UTC
-- Run every 5 minutes (catches west coast late games, pregame updates)
SELECT cron.schedule(
  'sync-live-scores-offpeak',
  '*/5 6-15 * * *',
  $$
  SELECT net.http_post(
    url := 'https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/sync-live-scores',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlanV3eWV5cGlnZ3ZseWZsaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjU4MDgsImV4cCI6MjA2OTU0MTgwOH0.XHylH6wJuJjSZxU904oCZ33N0swsoRm6Tr2VjwI1Lz0"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
