-- NOTHING WAS EVER CLOSING THE 2AM ROOMS.
--
-- A spun-up room carries expires_at and the app filters past-dated ones out of
-- Home, so they look gone. They are not: the row stays live, it still accepts
-- messages, its members still count, and anyone holding the link walks back
-- into a room that was supposed to be over. The closer this relied on was
-- scheduled with pg_cron, which is not enabled on this project, so the job
-- never existed.
--
-- This is the closer as a plain function. It can be called from a scheduled
-- edge function, from the dashboard, or by hand — none of which need pg_cron.
-- It is deliberately conservative: it only touches rooms that carry an expiry
-- and are already past it, and it never deletes anything. The room and its
-- messages remain; it stops being somewhere you can arrive.
CREATE OR REPLACE FUNCTION public.close_expired_side_huddles()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  closed integer;
BEGIN
  WITH done AS (
    UPDATE public.huddles
       SET is_private = true
     WHERE expires_at IS NOT NULL
       AND expires_at < now()
       AND COALESCE(is_private, false) = false
       AND COALESCE(is_official_team_huddle, false) = false
    RETURNING id
  )
  SELECT count(*)::integer INTO closed FROM done;

  RETURN closed;
END;
$$;

COMMENT ON FUNCTION public.close_expired_side_huddles() IS
  'Shuts the door on side huddles past their 2am: they stop being publicly '
  'reachable or discoverable. Nothing is deleted and members keep access. '
  'Returns how many were closed. Safe to run repeatedly.';
