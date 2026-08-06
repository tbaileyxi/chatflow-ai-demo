-- Fix: 20260707000003 added a p_day parameter, which created an OVERLOAD of
-- arena_claim_daily instead of replacing it — PostgREST then refuses calls
-- that don't specify p_day ("could not choose the best candidate"). Drop the
-- old 2-arg version; the 3-arg one defaults p_day anyway.
DROP FUNCTION IF EXISTS public.arena_claim_daily(uuid, text);
