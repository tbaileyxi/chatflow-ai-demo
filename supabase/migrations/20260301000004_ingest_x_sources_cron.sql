-- Schedule ingest-x-sources to run every 6 hours
SELECT cron.schedule(
  'ingest-x-sources-every-6h',
  '0 0,6,12,18 * * *',
  $$
  SELECT net.http_post(
    url := 'https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/ingest-x-sources',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlanV3eWV5cGlnZ3ZseWZsaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjU4MDgsImV4cCI6MjA2OTU0MTgwOH0.XHylH6wJuJjSZxU904oCZ33N0swsoRm6Tr2VjwI1Lz0"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
