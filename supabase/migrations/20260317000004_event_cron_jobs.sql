-- Requires pg_cron extension (enabled by default on Supabase)
-- and pg_net for HTTP calls to Edge Functions.

-- Daily pre-event pull at 06:00 UTC
select cron.schedule(
  'event-daily-pull',
  '0 6 * * *',
  $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/pull-event-content',
    body := '{"mode":"daily"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    )
  );
  $$
);

-- Pulse every 20 minutes for live events
select cron.schedule(
  'event-live-pulse',
  '*/20 * * * *',
  $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/pull-event-content',
    body := '{"mode":"pulse"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    )
  );
  $$
);

-- Auto-transition events to 'live' when starts_at passes
select cron.schedule(
  'event-status-transition',
  '* * * * *',
  $$
  update public.events
  set status = case
    when now() >= starts_at and now() < ends_at then 'live'
    when now() >= ends_at then 'ended'
    else status
  end
  where status != 'ended';
  $$
);
