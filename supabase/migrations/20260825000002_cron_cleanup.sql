-- Cron cleanup: one dead job, one duplicate. Nothing here touches the fade
-- pipeline, which is now correct.

-- 1) DEAD SINCE JANUARY. 'fades-settle-every-5min' (jobid 17) posts to the
--    function `fades-settle` — plural. No such function exists; the real one
--    is `fade-settle`, already scheduled as 'fade-settle-every-15min'. So this
--    has been firing a 404 every five minutes for seven months.
--    Matching on 'fades-settle' is safe: the working job's command says
--    '/fade-settle', which does not contain 'fades-settle'.
DO $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN SELECT jobid, jobname FROM cron.job WHERE command LIKE '%fades-settle%'
  LOOP
    PERFORM cron.unschedule(r.jobid);
    RAISE NOTICE 'removed dead job: % (jobid %)', r.jobname, r.jobid;
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'dead jobs removed: % (expect 1)', n;
END $$;

-- 2) DUPLICATE POLLER. Two jobs call bot-live-poller: 'bot-live-poller' every
--    minute (jobid 32) and 'bot-live-poller-2min' every two (jobid 61). That is
--    90 runs an hour where 30 was intended, and triple the calls to the live
--    score provider.
--
--    Keep the 2-minute one: FIX_LIVE_BOT_CRON.sql created it deliberately when
--    it retired the deleted live-game-bot zombie, and 2 minutes is the cadence
--    that was actually chosen. Anything else calling that function goes.
DO $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN
    SELECT jobid, jobname FROM cron.job
    WHERE command LIKE '%bot-live-poller%' AND jobname <> 'bot-live-poller-2min'
  LOOP
    PERFORM cron.unschedule(r.jobid);
    RAISE NOTICE 'removed duplicate poller: % (jobid %)', r.jobname, r.jobid;
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'duplicate pollers removed: % (expect 1)', n;
END $$;

-- 2b) MYSTERY JOB. Kalshi markets are still being created every 30 minutes
--     (13:30, 14:00, 14:30, 15:00 — all FCS college games) even though no job
--     NAMED kalshi-sync-markets exists any more, no Vercel cron or GitHub
--     Action calls it, and no edge function invokes it internally. So some job
--     whose name does not mention Kalshi is posting to that function. Matching
--     on the command catches it whatever it is called.
DO $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN SELECT jobid, jobname FROM cron.job WHERE command LIKE '%kalshi-sync-markets%'
  LOOP
    PERFORM cron.unschedule(r.jobid);
    RAISE NOTICE 'FOUND IT — job % (jobid %) was calling kalshi-sync-markets', r.jobname, r.jobid;
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'hidden kalshi-sync callers removed: %', n;
END $$;

-- 3) Confirm. Expect: no 'fades-settle-every-5min', exactly ONE bot-live-poller
--    row ('bot-live-poller-2min', */2), and the fade pipeline untouched:
--      sync-games-live-every-6h   35 */6
--      odds-sync-markets-every-4h 15 */4
--      fade-post-props-hourly     45 15-23,0-3
--      fade-settle-every-15min    10,25,40,55
--      odds-settle-every-30min    20,50
-- This listing shows what each job actually CALLS, not just what it is named.
-- Job names have drifted from their targets, which is how a kalshi sync hid in
-- plain sight. Read the calls_function column, not the jobname.
SELECT jobid,
       jobname,
       schedule,
       active,
       substring(command from 'functions/v1/([a-zA-Z0-9_-]+)') AS calls_function
FROM cron.job
ORDER BY jobid;
