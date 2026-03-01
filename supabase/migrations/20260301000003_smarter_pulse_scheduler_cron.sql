-- Remove the old 24/7 every-10-minute cron
SELECT cron.unschedule('pulse-scheduler-every-10min');

-- Active hours: 11am–1am ET ≈ hours 0-6 and 15-23 UTC (covers EST+EDT)
-- Run every 10 minutes during active hours
SELECT cron.schedule(
  'pulse-scheduler-active',
  '*/10 0-6,15-23 * * *',
  $$
  SELECT net.http_post(
    url := 'https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/pulse-scheduler',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlanV3eWV5cGlnZ3ZseWZsaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjU4MDgsImV4cCI6MjA2OTU0MTgwOH0.XHylH6wJuJjSZxU904oCZ33N0swsoRm6Tr2VjwI1Lz0"}'::jsonb,
    body := concat('{"time": "', now(), '"}')::jsonb
  ) AS request_id;
  $$
);

-- Off-hours: 7-14 UTC (roughly 2am–10am ET)
-- Run every 2 hours to keep feeds from going stale
SELECT cron.schedule(
  'pulse-scheduler-offhours',
  '0 8,10,12,14 * * *',
  $$
  SELECT net.http_post(
    url := 'https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/pulse-scheduler',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlanV3eWV5cGlnZ3ZseWZsaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjU4MDgsImV4cCI6MjA2OTU0MTgwOH0.XHylH6wJuJjSZxU904oCZ33N0swsoRm6Tr2VjwI1Lz0"}'::jsonb,
    body := concat('{"time": "', now(), '"}')::jsonb
  ) AS request_id;
  $$
);
