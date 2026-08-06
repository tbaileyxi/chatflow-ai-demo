-- PING — let a member rally their huddle when a game is near. Abuse controls:
--   • one ping per huddle per game (DB unique index)
--   • game-gated + membership checked in the edge function
--   • per-user opt-out via profiles.game_pings_enabled (Settings toggle)

CREATE TABLE IF NOT EXISTS public.huddle_pings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  huddle_id uuid NOT NULL REFERENCES public.huddles(id) ON DELETE CASCADE,
  game_id uuid REFERENCES public.games(id) ON DELETE SET NULL,
  sender_id uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- The cap: at most one ping per huddle per game.
CREATE UNIQUE INDEX IF NOT EXISTS huddle_pings_once_per_game
  ON public.huddle_pings(huddle_id, game_id);
CREATE INDEX IF NOT EXISTS idx_huddle_pings_huddle ON public.huddle_pings(huddle_id);

-- Opt-out for game-day pings (Settings → Notifications). Default on.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS game_pings_enabled boolean DEFAULT true;

ALTER TABLE public.huddle_pings ENABLE ROW LEVEL SECURITY;

-- Members can see whether their huddle has already been pinged for the game
-- (so the button can show its "already rallied" state). Writes go through the
-- edge function (service role), so there's no client INSERT policy.
CREATE POLICY "Members read huddle pings"
  ON public.huddle_pings FOR SELECT
  USING (auth.uid() IS NOT NULL AND public.is_huddle_member(huddle_id, auth.uid()));
