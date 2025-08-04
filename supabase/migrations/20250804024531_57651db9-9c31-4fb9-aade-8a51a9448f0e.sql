-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a cron job to process scheduled broadcasts every minute
SELECT cron.schedule(
  'process-scheduled-broadcasts',
  '* * * * *', -- every minute
  $$
  SELECT
    net.http_post(
        url:='https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/process-scheduled-broadcasts',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlanV3eWV5cGlnZ3ZseWZsaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjU4MDgsImV4cCI6MjA2OTU0MTgwOH0.XHylH6wJuJjSZxU904oCZ33N0swsoRm6Tr2VjwI1Lz0"}'::jsonb,
        body:='{"automated": true}'::jsonb
    ) as request_id;
  $$
);