-- MLB battles get the Polymarket trade-flow stream too: arena-live-odds now
-- matches each game to its Polymarket market and stores the condition id the
-- client streams trades from.
ALTER TABLE public.arena_live_odds ADD COLUMN IF NOT EXISTS pm_condition text;
ALTER TABLE public.arena_live_odds ADD COLUMN IF NOT EXISTS pm_a_outcome text;
