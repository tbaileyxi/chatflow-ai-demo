-- Update pickem-scoring cron to run every 30 minutes (backup only)
SELECT cron.unschedule('pickem-scoring-cron');

SELECT cron.schedule(
  'pickem-scoring-cron',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url:='https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/pickem-scoring',
    headers:='{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlanV3eWV5cGlnZ3ZseWZsaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjU4MDgsImV4cCI6MjA2OTU0MTgwOH0.XHylH6wJuJjSZxU904oCZ33N0swsoRm6Tr2VjwI1Lz0"}'::jsonb
  ) as request_id;
  $$
);