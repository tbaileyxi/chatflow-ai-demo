-- Schedule Kalshi edge functions via pg_cron
-- pg_cron and pg_net are already enabled from earlier migrations

-- Unschedule if they already exist (idempotent)
DO $$ BEGIN
  PERFORM cron.unschedule('kalshi-sync-markets-every-30min');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  PERFORM cron.unschedule('kalshi-post-predictions-hourly-game-hours');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  PERFORM cron.unschedule('kalshi-settle-every-30min');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 1) kalshi-sync-markets — every 30 minutes
SELECT cron.schedule(
  'kalshi-sync-markets-every-30min',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/kalshi-sync-markets',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 2) kalshi-post-predictions — every hour during game hours (noon–midnight ET = 17:00–05:00 UTC)
SELECT cron.schedule(
  'kalshi-post-predictions-hourly-game-hours',
  '0 17-23,0-4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/kalshi-post-predictions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 3) kalshi-settle — every 30 minutes
SELECT cron.schedule(
  'kalshi-settle-every-30min',
  '15,45 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/kalshi-settle',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
