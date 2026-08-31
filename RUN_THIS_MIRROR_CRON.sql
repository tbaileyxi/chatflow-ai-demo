-- Check for new creator posts on a schedule.
--
-- The function is cheap and idempotent: it asks X what a wired room's account
-- has posted, skips the room entirely if it has heard from them in the last
-- ninety minutes, and posts at most one. Running it every fifteen minutes means
-- a post shows up within a quarter hour of being written, which is the point —
-- their voice arriving through the day, not a batch at midnight.
--
-- Rooms with no x_handle cost nothing: the query returns none and it exits.
--
-- Run in the Supabase SQL editor. Safe to run twice.

do $$
declare j record;
begin
  for j in select jobid, jobname from cron.job where command like '%creator-mirror%' loop
    perform cron.unschedule(j.jobid);
    raise notice 'unscheduled existing job % (%)', j.jobid, j.jobname;
  end loop;
end;
$$;

select cron.schedule(
  'creator-mirror-15min',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/creator-mirror',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlanV3eWV5cGlnZ3ZseWZsaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjU4MDgsImV4cCI6MjA2OTU0MTgwOH0.XHylH6wJuJjSZxU904oCZ33N0swsoRm6Tr2VjwI1Lz0'
    ),
    body := '{}'::jsonb
  );
  $$
);

select jobname, schedule, active from cron.job where jobname = 'creator-mirror-15min';
