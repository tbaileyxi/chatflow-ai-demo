-- Enable RLS on presence_notification_log.
-- This table is only accessed by the send-push-notification Edge Function
-- via the service role key, which bypasses RLS — no user policies needed.
ALTER TABLE public.presence_notification_log ENABLE ROW LEVEL SECURITY;
