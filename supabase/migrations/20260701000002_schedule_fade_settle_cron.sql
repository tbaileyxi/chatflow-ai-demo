-- Schedule fade-settle: grade locked fades from final scores + expire stale
-- open props. Runs every 15 minutes, offset from the odds cron.

DO $$ BEGIN
  PERFORM cron.unschedule('fade-settle-every-15min');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'fade-settle-every-15min',
  '10,25,40,55 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/fade-settle',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
