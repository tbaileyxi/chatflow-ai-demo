-- Arena v2.3 — the morning-after fixes:
--   1. CRON: the two arena jobs never fired (older project crons do). Rebuild
--      them using the project's PUBLIC anon key as the bearer — it passes the
--      functions' JWT verification and removes the dependency on
--      app.settings.service_role_key entirely. (The anon key is already public
--      in the web client; this leaks nothing.)
--   2. GATES: no new stakes once a battle passes 85/15 — kills the
--      late-game pile-on exploit. Seed rebalancing (in the sync functions)
--      handles the mid-game price drift.
-- The SELECTs at the end are diagnostics: run results for the old jobs.

DO $$ BEGIN
  PERFORM cron.unschedule('arena-live-odds-every-2min');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  PERFORM cron.unschedule('arena-sync-events-every-2min');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'arena-live-odds-every-2min',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/arena-live-odds',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlanV3eWV5cGlnZ3ZseWZsaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjU4MDgsImV4cCI6MjA2OTU0MTgwOH0.XHylH6wJuJjSZxU904oCZ33N0swsoRm6Tr2VjwI1Lz0'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'arena-sync-events-every-2min',
  '1-59/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/arena-sync-events',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlanV3eWV5cGlnZ3ZseWZsaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjU4MDgsImV4cCI6MjA2OTU0MTgwOH0.XHylH6wJuJjSZxU904oCZ33N0swsoRm6Tr2VjwI1Lz0'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ---------------------------------------------------------------------------
-- Gates: refuse stakes once the battle is effectively decided (>=85% either
-- way). Uses the freshest line we have; falls back to allowing the stake if
-- no line exists (pre-game markets are never gated by this).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.arena_place_stake_v2(
  p_client uuid, p_side text, p_amount integer,
  p_game uuid DEFAULT NULL, p_event uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_bankroll integer;
  v_status text;
  v_prob numeric;
BEGIN
  IF p_side NOT IN ('home', 'away') OR p_amount < 1 OR p_amount > 500 THEN
    RAISE EXCEPTION 'invalid stake';
  END IF;
  IF (p_game IS NULL) = (p_event IS NULL) THEN
    RAISE EXCEPTION 'stake exactly one target';
  END IF;

  IF p_game IS NOT NULL THEN
    SELECT status INTO v_status FROM games WHERE id = p_game;
    IF v_status IS NULL OR v_status IN ('final', 'completed') THEN
      RAISE EXCEPTION 'game not open';
    END IF;
    SELECT home_prob INTO v_prob FROM arena_live_odds
    WHERE game_id = p_game AND updated_at > now() - interval '10 minutes';
  ELSE
    SELECT status, prob_a INTO v_status, v_prob FROM arena_events WHERE id = p_event;
    IF v_status IS NULL OR v_status = 'final' THEN
      RAISE EXCEPTION 'event not open';
    END IF;
  END IF;

  IF v_prob IS NOT NULL AND (v_prob >= 0.85 OR v_prob <= 0.15) THEN
    RAISE EXCEPTION 'gates closed — battle is decided';
  END IF;

  SELECT bankroll INTO v_bankroll FROM arena_players
  WHERE client_id = p_client FOR UPDATE;
  IF v_bankroll IS NULL THEN
    RAISE EXCEPTION 'no player — claim daily chips first';
  END IF;
  IF v_bankroll < p_amount THEN
    RAISE EXCEPTION 'insufficient bankroll';
  END IF;

  UPDATE arena_players SET bankroll = bankroll - p_amount, updated_at = now()
  WHERE client_id = p_client;
  INSERT INTO arena_stakes (game_id, event_id, client_id, side, amount)
  VALUES (p_game, p_event, p_client, p_side, p_amount);

  RETURN jsonb_build_object('bankroll', v_bankroll - p_amount);
END;
$$;

-- ---------------------------------------------------------------------------
-- Diagnostics: what were the OLD arena jobs doing? (informational output)
-- ---------------------------------------------------------------------------
SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname LIKE 'arena%';

SELECT j.jobname, d.status, left(d.return_message, 80) AS msg, d.start_time
FROM cron.job_run_details d JOIN cron.job j ON j.jobid = d.jobid
WHERE j.jobname LIKE 'arena%'
ORDER BY d.start_time DESC LIMIT 10;
