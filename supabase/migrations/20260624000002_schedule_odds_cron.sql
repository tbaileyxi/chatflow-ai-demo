-- Schedule the Odds API prediction pipeline (Phase 1: MLB team markets).
-- Mirrors the kalshi cron pattern. kalshi-post-predictions already runs hourly
-- and is league-agnostic, so it posts these markets too — no new poster cron.

DO $$ BEGIN
  PERFORM cron.unschedule('odds-sync-markets-every-30min');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  PERFORM cron.unschedule('odds-settle-every-30min');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 1) odds-sync-markets — pull fresh MLB markets/lines every 30 minutes.
SELECT cron.schedule(
  'odds-sync-markets-every-30min',
  '5,35 * * * *',
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

-- 2) odds-settle — resolve finished games every 30 minutes (offset from sync).
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
