-- Fix the SportsGameOdds crons. Run this in the Supabase SQL Editor.
--
-- WHY THIS IS URGENT: odds-sync-markets is still on the original every-30-min
-- schedule (the July throttle migration was written but never applied). At 48
-- runs/day that is what exhausted the SGO plan in June — every run then 429'd,
-- which is why no SGO market was created between 2026-06-25 and today even
-- though the function itself works fine.
--
-- On 2026-08-24 ODDS_LEAGUES was widened from "MLB" to "MLB,NFL,NCAAF" so that
-- college football and the NFL get real spreads/totals/player props. That took
-- each run from ~2 API calls to ~5. On the old 30-minute cron that is ~240
-- calls/day — straight back into the burn. On the 4-hour cron below it is ~30.
--
-- Safe to run more than once: every schedule is dropped by name first.

-- 1) Kill the burner, whatever it is currently called.
DO $$ BEGIN PERFORM cron.unschedule('odds-sync-markets-every-30min');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('odds-sync-markets-every-4h');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 2) Sync every 4 hours. Lines for a virtual-chips game do not need
--    half-hourly precision; having ANY fresh line matters far more.
SELECT cron.schedule(
  'odds-sync-markets-every-4h',
  '15 */4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/odds-sync-markets',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 3) odds-settle stays frequent on purpose: it is cheap, only calls SGO for
--    games that have actually FINISHED, and settling late means a player's
--    chips sit locked. Player-prop and college fades can ONLY be graded from
--    the market's own YES/NO result, which is what this writes — without it
--    those fades never pay out.
DO $$ BEGIN PERFORM cron.unschedule('odds-settle-every-30min');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'odds-settle-every-30min',
  '20,50 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/odds-settle',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);


-- ---------------------------------------------------------------------------
-- 4) sync-games-live — THE ONE THAT WAS NEVER SCHEDULED AT ALL.
--
-- `games` is the gate on every fade card: fade-post-props only posts for games
-- that exist in that table, because fade-settle grades from them. Nothing has
-- ever put sync-games-live on a cron, so `games` only filled when somebody
-- invoked it by hand. It had gone stale enough that on 2026-08-25 there were
-- ZERO upcoming MLB games in the table and no cards could post for that night.
-- One manual run added 481 games (15 MLB that night, 106 college).
--
-- Every 6 hours, not every 30 minutes: this costs 6 the-odds-api calls per run
-- (one per sport), schedules are published days ahead, and LIVE scores are
-- already handled by the separate sync-live-scores cron.
-- ---------------------------------------------------------------------------
DO $$ BEGIN PERFORM cron.unschedule('sync-games-live-every-6h');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

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

-- ---------------------------------------------------------------------------
-- 5) ONE market source. Fade now reads SGO markets only (FADE_SOURCE=sgo), so
-- kalshi-sync-markets is writing rows nothing consumes — and its college slate
-- is FCS schools with no rooms. Stop the sync.
--
-- kalshi-settle is deliberately LEFT RUNNING: shadow bets and fades already
-- placed against Kalshi markets still have to grade out and pay. Once those
-- have settled it can be unscheduled too.
-- ---------------------------------------------------------------------------
DO $$ BEGIN PERFORM cron.unschedule('kalshi-sync-markets-every-30min');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Confirm. Expected after running:
--   odds-sync-markets-every-4h    '15 */4 * * *'    active
--   odds-settle-every-30min       '20,50 * * * *'   active
--   NO row named odds-sync-markets-every-30min
-- ---------------------------------------------------------------------------
SELECT jobname, schedule, active
FROM cron.job
WHERE jobname LIKE 'odds%' OR jobname LIKE 'fade%' OR jobname LIKE 'kalshi%'
   OR jobname LIKE 'sync-games%'
ORDER BY jobname;
