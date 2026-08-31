-- Last cron file. Fixes the three that never applied. No swallowed errors;
-- every block says what it did.

-- 1) Retire the yes/no prediction cards. Still scheduled as jobid 19.
DO $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN SELECT jobid, jobname FROM cron.job WHERE command LIKE '%kalshi-post-predictions%'
  LOOP
    PERFORM cron.unschedule(r.jobid);
    RAISE NOTICE 'removed prediction-card poster: % (jobid %)', r.jobname, r.jobid;
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'prediction-card jobs removed: %', n;
END $$;

-- 2) Fade cards hourly through the game window instead of 3x daily.
--    Drop whatever currently calls fade-post-props, whatever it is named.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT jobid, jobname FROM cron.job WHERE command LIKE '%fade-post-props%'
  LOOP
    PERFORM cron.unschedule(r.jobid);
    RAISE NOTICE 'removed old fade poster: % (jobid %)', r.jobname, r.jobid;
  END LOOP;
END $$;

SELECT cron.schedule(
  'fade-post-props-hourly',
  '45 15-23,0-3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/fade-post-props',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 3) THE IMPORTANT ONE. sync-games-live has never been scheduled, which is why
--    `games` emptied out and no cards could post this morning. Every fade card
--    requires its game to exist in that table.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT jobid, jobname FROM cron.job WHERE command LIKE '%sync-games-live%'
  LOOP
    PERFORM cron.unschedule(r.jobid);
    RAISE NOTICE 'removed existing games sync: %', r.jobname;
  END LOOP;
END $$;

SELECT cron.schedule(
  'sync-games-live-every-6h',
  '35 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/sync-games-live',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 4) Final state — EVERY job, unfiltered, so nothing hides.
SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobid;
