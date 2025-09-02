-- Set up cron job to run live-game-bot every minute for real-time updates
SELECT cron.schedule(
  'live-game-bot-polling',
  '* * * * *', -- every minute
  $$
  SELECT
    net.http_post(
        url:='https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/live-game-bot',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlanV3eWV5cGlnZ3ZseWZsaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjU4MDgsImV4cCI6MjA2OTU0MTgwOH0.XHylH6wJuJjSZxU904oCZ33N0swsoRm6Tr2VjwI1Lz0"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);