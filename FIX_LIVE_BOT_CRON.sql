-- The live bot has no schedule, and a deleted one still has yours.
--
-- WHAT I FOUND
-- 'live-game-bot-updates' (migration 20250902014819) fires every 2 minutes at
-- the function live-game-bot. That function's SOURCE was deleted from the repo,
-- but a deployed Edge Function outlives its source — it is still ACTIVE at
-- version 288 and still posting into rooms as message_type 'text'.
--
-- Meanwhile bot-live-poller — the one that narrates plays, covers both sides,
-- and now pulls the clip from X — is on NO schedule at all. It has only ever
-- run when triggered by hand. That is why rooms are quiet during games.
--
-- STEP 1 shows you the truth (I cannot read cron.job with the public key).
-- STEP 2 retires the zombie and schedules the real one.

-- ===== STEP 1: LOOK. =====
select jobname, schedule, active from cron.job order by jobname;

-- ===== STEP 2: retire the deleted bot, schedule the real one. =====
select cron.unschedule('live-game-bot-updates')
where exists (select 1 from cron.job where jobname = 'live-game-bot-updates');

select cron.unschedule('bot-live-poller-2min')
where exists (select 1 from cron.job where jobname = 'bot-live-poller-2min');

select cron.schedule(
  'bot-live-poller-2min',
  '*/2 * * * *',
  $$
  select net.http_post(
    url := 'https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/bot-live-poller',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlanV3eWV5cGlnZ3ZseWZsaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjU4MDgsImV4cCI6MjA2OTU0MTgwOH0.XHylH6wJuJjSZxU904oCZ33N0swsoRm6Tr2VjwI1Lz0"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- Confirm: bot-live-poller-2min active, live-game-bot-updates gone.
select jobname, schedule, active from cron.job order by jobname;
