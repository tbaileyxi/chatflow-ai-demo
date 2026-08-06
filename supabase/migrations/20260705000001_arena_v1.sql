-- Arena v1 — standalone web arena (NOT wired into the mobile app / huddles).
-- Two tables:
--   arena_stakes     — every chip throw, from anonymous web clients. Realtime
--                      fans it out so everyone's screen shows real activity.
--   arena_live_odds  — live de-vigged home win prob per game, written by the
--                      arena-live-odds function (SGO), read by the arena page.
-- Chips are virtual with no cash value; stakes are capped small and clients
-- are anonymous (client-generated uuid), so RLS allows anon insert.

CREATE TABLE IF NOT EXISTS public.arena_stakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  side text NOT NULL CHECK (side IN ('home', 'away')),
  amount integer NOT NULL CHECK (amount > 0 AND amount <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS arena_stakes_game_idx ON public.arena_stakes (game_id, created_at);

ALTER TABLE public.arena_stakes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "arena stakes are public" ON public.arena_stakes;
CREATE POLICY "arena stakes are public"
  ON public.arena_stakes FOR SELECT USING (true);

DROP POLICY IF EXISTS "anyone can stake" ON public.arena_stakes;
CREATE POLICY "anyone can stake"
  ON public.arena_stakes FOR INSERT WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.arena_live_odds (
  game_id uuid PRIMARY KEY REFERENCES public.games(id) ON DELETE CASCADE,
  home_prob numeric NOT NULL CHECK (home_prob > 0 AND home_prob < 1),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.arena_live_odds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "arena odds are public" ON public.arena_live_odds;
CREATE POLICY "arena odds are public"
  ON public.arena_live_odds FOR SELECT USING (true);
-- no INSERT/UPDATE policies: only the service role (arena-live-odds fn) writes.

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.arena_stakes;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.arena_live_odds;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Poll live prices every 2 minutes. The function exits fast (no SGO call)
-- when nothing is live or about to start, so idle cost is one cheap query.
DO $$ BEGIN
  PERFORM cron.unschedule('arena-live-odds-every-2min');
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
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
