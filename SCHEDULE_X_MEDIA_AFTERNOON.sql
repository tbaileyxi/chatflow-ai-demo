-- Second daily X media run, 5:15pm ET.
--
-- Safe to add: bot-x-media skips any team that already posted today, so this
-- can only pick up teams the morning run came back empty on. On a day when
-- the 9:15 run filled every room, this costs nothing at all.
--
-- Worth having because xAI search results vary run to run — the same query
-- returned nothing twice and a usable photo on the third attempt. A second
-- look is a second draw, not a second post.

select cron.unschedule('x-media-afternoon')
where exists (select 1 from cron.job where jobname = 'x-media-afternoon');

select cron.schedule(
  'x-media-afternoon',
  '15 21 * * *',  -- 21:15 UTC = 5:15pm ET
  $$
  select net.http_post(
    url := 'https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/bot-x-media',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlanV3eWV5cGlnZ3ZseWZsaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjU4MDgsImV4cCI6MjA2OTU0MTgwOH0.XHylH6wJuJjSZxU904oCZ33N0swsoRm6Tr2VjwI1Lz0"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- Both jobs should be listed and active:
select jobname, schedule, active from cron.job where jobname like 'x-media%';
