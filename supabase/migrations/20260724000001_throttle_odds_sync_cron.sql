-- Throttle the odds sync so it stops exhausting the SportsGameOdds plan.
--
-- The original schedule (every 30 min) combined with a 48h window and 6 pages
-- cost ~288 API calls/day. The plan was spent within two days of the cron going
-- live on 2026-06-24, and every market in the app froze on 2026-06-26 — no new
-- lines, no fadeable props, until this was found on 2026-07-24.
--
-- Paired with the function-side reduction (24h window, 2 pages), running every
-- four hours costs ~12 calls/day. Lines for a virtual-chips game do not need
-- half-hourly precision; having any fresh line at all matters far more.

DO $$ BEGIN
  PERFORM cron.unschedule('odds-sync-markets-every-30min');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  PERFORM cron.unschedule('odds-sync-markets-every-4h');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

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

-- odds-settle stays frequent: it is cheap, only calls SGO for games that have
-- actually finished, and settling late means chips sit locked in players' hands.
