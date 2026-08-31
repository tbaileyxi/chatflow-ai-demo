-- Per-recipient throttle for "Friend watching now".
--
-- The log only recorded (huddle_id, user_id=the person who ENTERED), so it
-- stopped re-announcing the same person but placed no limit on how many pings
-- one recipient could take. Fifteen people arriving for a game meant fifteen
-- pushes each — the fastest way to get notifications turned off for good.
--
-- recipient_id is nullable so the existing rows (which are enterer-only)
-- stay valid and keep working as the "don't re-announce this person" check.

ALTER TABLE public.presence_notification_log
  ADD COLUMN IF NOT EXISTS recipient_id UUID;

-- Throttle lookup: "has THIS person been told about THIS room in the last hour?"
CREATE INDEX IF NOT EXISTS idx_presence_notif_recipient
  ON public.presence_notification_log(huddle_id, recipient_id, notified_at DESC)
  WHERE recipient_id IS NOT NULL;
