-- Daily X media drop: one photo or clip per room, 9:15am ET.
--
-- Uses the PUBLISHABLE key on purpose. It is already shipped inside the app
-- bundle, so it is not a secret, and this avoids putting a service-role key
-- into a cron definition that any project member can read back out of
-- cron.job. The function itself uses its own service-role key internally.

select cron.unschedule('x-media-daily')
where exists (select 1 from cron.job where jobname = 'x-media-daily');

select cron.schedule(
  'x-media-daily',
  '15 13 * * *',  -- 13:15 UTC = 9:15am ET
  $$
  select net.http_post(
    url := 'https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/bot-x-media',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlanV3eWV5cGlnZ3ZseWZsaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjU4MDgsImV4cCI6MjA2OTU0MTgwOH0.XHylH6wJuJjSZxU904oCZ33N0swsoRm6Tr2VjwI1Lz0"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- Confirm it registered:
select jobname, schedule, active from cron.job where jobname = 'x-media-daily';
