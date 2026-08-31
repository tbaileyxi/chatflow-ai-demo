-- Content cadence, both changes in one run.
--
--   1. In-game X clips  — new. Fires only while a team is actually playing.
--   2. News 48x/day -> 5x/day — the cost fix now that news comes from X search,
--      which bills per call where RSS was free to fetch.
--
-- Safe to run more than once; every job is dropped by name first.

-- ---------------------------------------------------------------------------
-- 1) IN-GAME CLIPS
--
-- The clip bot already posts one photo/video per team per day at 9:15am and
-- 5:15pm ET. Those two jobs are NOT touched. This is a third cadence that
-- passes {"in_game_only": true}, so every team not on the field is skipped
-- before any X search happens — verified: one live team out of ten cost one
-- search, not ten. Cost scales with live games, not with the clock.
--
-- Every 12 minutes through the US game window. The bot caps itself at one clip
-- per team per 12 minutes, so a tighter cron cannot spam a room.
-- ---------------------------------------------------------------------------
DO $$ BEGIN PERFORM cron.unschedule('x-media-in-game');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'x-media-in-game',
  '*/12 17-23,0-5 * * *',
  $$
  SELECT net.http_post(
    url := 'https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/bot-x-media',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"in_game_only": true}'::jsonb
  ) AS request_id;
  $$
);

-- ---------------------------------------------------------------------------
-- 2) NEWS CADENCE
--
-- Was '*/30' — 48 runs a day, identical on a Tuesday in July and a Sunday.
-- Now five named times: 8am, 12pm, 4pm, 8pm and 11pm ET.
--
-- Nothing is lost. The daily cap is already 5 posts per team per 24h, so 48
-- runs were never producing 48 posts — they were producing the same 5 posts
-- and burning 43 wasted searches getting there. News also already hushes
-- itself while a game is in progress and for 30 minutes before kickoff.
--
-- Old job name is 'bot-news-poller'; dropped by that name and by the new one.
-- ---------------------------------------------------------------------------
DO $$ BEGIN PERFORM cron.unschedule('bot-news-poller');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('bot-news-poller-5x-daily');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'bot-news-poller-5x-daily',
  '0 12,16,20,0,3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/bot-news-poller',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ---------------------------------------------------------------------------
-- Confirm. Expect:
--   x-media-daily             15 13 * * *          (unchanged)
--   x-media-afternoon         15 21 * * *          (unchanged)
--   x-media-in-game           */12 17-23,0-5 * * * (NEW)
--   bot-news-poller-5x-daily  0 12,16,20,0,3 * * * (replaces */30)
--   NO row named 'bot-news-poller'
-- ---------------------------------------------------------------------------
SELECT jobid, jobname, schedule, active,
       substring(command from 'functions/v1/([a-zA-Z0-9_-]+)') AS calls_function
FROM cron.job
WHERE command LIKE '%bot-x-media%' OR command LIKE '%bot-news-poller%'
ORDER BY jobname;
