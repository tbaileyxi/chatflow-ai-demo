-- Diagnose + fix, in one run. Nothing here swallows errors.
--
-- The previous file unscheduled by NAME and wrapped each call in
-- "EXCEPTION WHEN OTHERS THEN NULL". kalshi-sync-markets kept running anyway
-- (new markets at 13:00:08 and 13:30:08, dead on its */30 schedule), and the
-- swallowed exception meant the run looked successful. Almost certainly the
-- live job is named something other than 'kalshi-sync-markets-every-30min'.
--
-- This matches on the job's COMMAND instead, so the name does not matter.

-- STEP 1 — what is actually scheduled right now.
SELECT jobid, jobname, schedule, active
FROM cron.job
ORDER BY jobname;

-- STEP 2 — unschedule every job that calls kalshi-sync-markets, by jobid,
-- and say which ones it touched. If this prints no NOTICE, nothing matched
-- and STEP 1's output tells us why.
DO $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN
    SELECT jobid, jobname FROM cron.job WHERE command LIKE '%kalshi-sync-markets%'
  LOOP
    PERFORM cron.unschedule(r.jobid);
    RAISE NOTICE 'unscheduled: % (jobid %)', r.jobname, r.jobid;
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'total kalshi-sync jobs removed: %', n;
END $$;

-- STEP 3 — same treatment for the odds-sync burner, in case that one also
-- failed to unschedule by name. Anything calling odds-sync-markets on a
-- schedule other than the intended 4-hourly one gets removed.
DO $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN
    SELECT jobid, jobname, schedule FROM cron.job
    WHERE command LIKE '%odds-sync-markets%' AND schedule <> '15 */4 * * *'
  LOOP
    PERFORM cron.unschedule(r.jobid);
    RAISE NOTICE 'removed stale odds-sync job: % (% )', r.jobname, r.schedule;
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'stale odds-sync jobs removed: %', n;
END $$;

-- STEP 4 — confirm the end state.
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE command LIKE '%kalshi%'
   OR command LIKE '%odds-%'
   OR command LIKE '%fade-%'
   OR command LIKE '%sync-games-live%'
ORDER BY jobname;
