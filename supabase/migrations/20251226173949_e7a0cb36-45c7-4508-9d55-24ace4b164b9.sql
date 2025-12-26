-- Create cron job to send activity emails daily at 10 AM ET (15:00 UTC)
SELECT
  cron.schedule(
    'send-activity-email-daily',
    '0 15 * * *',
    $$
    SELECT
      net.http_post(
          url:='https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/send-activity-email',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlanV3eWV5cGlnZ3ZseWZsaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjU4MDgsImV4cCI6MjA2OTU0MTgwOH0.XHylH6wJuJjSZxU904oCZ33N0swsoRm6Tr2VjwI1Lz0"}'::jsonb,
          body:='{}'::jsonb
      ) as request_id;
    $$
  )