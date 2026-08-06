-- Drop unclaimed fade props into gameday rooms a few times a day. Cheap: it
-- reads existing kalshi_markets (no external API) and only posts for games in
-- the `games` table that haven't started. Offset from odds-sync so fresh lines
-- exist before props are posted.

DO $$ BEGIN
  PERFORM cron.unschedule('fade-post-props-3x-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'fade-post-props-3x-daily',
  '45 13,17,21 * * *',
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
