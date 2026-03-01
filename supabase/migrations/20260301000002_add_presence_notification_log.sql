-- Track presence notifications to enforce 1-per-hour-per-user throttle
CREATE TABLE IF NOT EXISTS public.presence_notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  huddle_id UUID NOT NULL REFERENCES public.huddles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  notified_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for efficient throttle lookups
CREATE INDEX IF NOT EXISTS idx_presence_notif_lookup
ON public.presence_notification_log(huddle_id, user_id, notified_at DESC);

-- Auto-cleanup: remove entries older than 2 hours to keep table small
-- (only need 1-hour window for throttle, 2h gives buffer)
CREATE OR REPLACE FUNCTION cleanup_old_presence_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM public.presence_notification_log
  WHERE notified_at < now() - INTERVAL '2 hours';
END;
$$ LANGUAGE plpgsql;
