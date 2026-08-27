-- Retire the yes/no prediction cards.
--
-- A market card asks "Will the Yankees win?" at 62¢ and offers YES / NO. In a
-- Yankees room every member taps YES, so there is no argument and no game —
-- the format quietly punishes the one emotion the room runs on. Fade replaces
-- it: a real line, a side already taken by a name you know, and the other side
-- left open.
--
-- WHAT STAYS RUNNING, deliberately:
--   * kalshi-sync-markets  — fade reads its lines from kalshi_markets. Killing
--                            this would starve the thing replacing predictions.
--   * kalshi-settle        — shadow bets already placed still have to grade
--                            out and pay. Members keep chips they have won.
--
-- Only the POSTING of new cards stops here. In-flight bets settle normally and
-- then the surface is empty on its own.

DO $$ BEGIN
  PERFORM cron.unschedule('kalshi-post-predictions-hourly-game-hours');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Fade props are now the gameday card, so widen their window: was 3x daily at
-- 13:45/17:45/21:45 UTC, which posted the whole slate before most games and
-- nothing at all during the evening. Hourly through the US game window keeps a
-- card arriving while people are actually in the room. The function is cheap —
-- it reads existing kalshi_markets and posts nothing when there is no game.
DO $$ BEGIN
  PERFORM cron.unschedule('fade-post-props-3x-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  PERFORM cron.unschedule('fade-post-props-hourly');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'fade-post-props-hourly',
  '45 15-23,0-3 * * *',
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
