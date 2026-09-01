-- "What you missed" digest email — check it, then turn it on.
--
-- Run part 1 first and READ THE OUTPUT. Only run part 2 if part 1 shows the
-- job missing or pointing somewhere else.

-- ── 1. What is actually scheduled ───────────────────────────────────────────
-- Matching on the command, not the name: job names in this project have not
-- matched what the job does, and a name lookup returns "not scheduled" for a
-- job that is running fine under a different name.
SELECT jobid, jobname, schedule, active,
       left(command, 120) AS command_start
FROM cron.job
WHERE command ILIKE '%send-activity-email%';


-- ── 2. Schedule it (only if part 1 found nothing) ───────────────────────────
-- Daily at 16:00 UTC — noon Eastern, which lands mid-morning across the US and
-- not in the middle of the night for anyone. The function itself refuses to
-- email the same person twice inside 48 hours, so a daily run is not a daily
-- email; it is a daily CHECK.
--
-- Unschedule first, deliberately NOT wrapped in an exception handler: if the
-- job exists under another name this must fail loudly rather than quietly
-- create a second one that double-sends.

-- SELECT cron.unschedule(jobid) FROM cron.job WHERE command ILIKE '%send-activity-email%';

-- SELECT cron.schedule(
--   'send-activity-email-daily',
--   '0 16 * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/send-activity-email',
--     headers := '{"Content-Type": "application/json"}'::jsonb,
--     body := '{}'::jsonb
--   );
--   $$
-- );


-- ── 3. Who would get one right now ──────────────────────────────────────────
-- Sanity check before turning it on. If this returns nobody, the digest has
-- nothing to say and scheduling it changes nothing.
SELECT count(DISTINCT hm.user_id) AS people_with_unread
FROM huddle_members hm
JOIN huddle_messages m ON m.huddle_id = hm.huddle_id
WHERE m.created_at > now() - interval '48 hours'
  AND m.user_id <> hm.user_id;
