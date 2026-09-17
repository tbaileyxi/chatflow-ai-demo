-- THE FOUNDING PARTNER, AND NOTHING ELSE.
--
-- One business per team per season. This is the whole store: a team slug, the
-- partner's name as it should be printed, their category (which is what the
-- exclusivity is actually against), and the season it covers.
--
-- Deliberately NOT attached to a room. The partnership buys two moments — the
-- pregame card and the caption under a clip — and nothing permanent. A column
-- pointing at a huddle would be the first step toward a logo in a header, so
-- there isn't one.
CREATE TABLE IF NOT EXISTS public.founding_partners (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_slug    text NOT NULL,
  partner_name text NOT NULL,
  category     text,
  season       integer NOT NULL DEFAULT date_part('year', now())::integer,
  created_at   timestamptz NOT NULL DEFAULT now(),
  -- One per team per season is the product, so the database says so rather
  -- than trusting every future insert to remember.
  UNIQUE (team_slug, season)
);

ALTER TABLE public.founding_partners ENABLE ROW LEVEL SECURITY;

-- The partner's name is printed in rooms and on the sponsor page, so reading it
-- is public. Writing it is fulfillment's job, which runs as the service role.
DROP POLICY IF EXISTS "Anyone can read founding partners" ON public.founding_partners;
CREATE POLICY "Anyone can read founding partners"
ON public.founding_partners
FOR SELECT
USING (true);

CREATE INDEX IF NOT EXISTS founding_partners_slug_season
  ON public.founding_partners (team_slug, season);

-- One test row, so the surfaces can be built and screenshotted against real
-- data rather than a hardcoded name.
INSERT INTO public.founding_partners (team_slug, partner_name, category, season)
VALUES ('cleveland-browns', 'Joe''s Cars', 'auto dealer', date_part('year', now())::integer)
ON CONFLICT (team_slug, season) DO UPDATE
  SET partner_name = EXCLUDED.partner_name,
      category     = EXCLUDED.category;
