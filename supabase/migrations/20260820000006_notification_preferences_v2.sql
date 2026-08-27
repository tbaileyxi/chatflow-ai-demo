-- Notification controls for the signals that had none.
--
-- "Friend watching now" and "Someone you know is here" both just went live with
-- no off switch. The only way to stop either was iOS Settings → turn off Side
-- Huddle entirely, which also kills Rally, invites and everything else. One
-- annoying notification should never cost you all of them.
--
-- WHY game_pings_enabled STAYS ON profiles: the shipped app writes it there via
-- GamePingsToggle. Moving it would silently break that toggle for everyone who
-- hasn't updated yet. The settings screen presents one list; the split storage
-- is invisible to users and costs nothing.

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS presence_active_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS friend_joined_enabled   boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS room_invite_enabled     boolean DEFAULT true;

-- The table has never had a single row: nothing created them and no UI wrote to
-- them. Reads happened to work because "no row" falls through to the default,
-- but nobody could actually change anything. Give every existing user a row.
INSERT INTO public.notification_preferences (user_id)
SELECT p.user_id
FROM public.profiles p
ON CONFLICT (user_id) DO NOTHING;

-- And every future one.
CREATE OR REPLACE FUNCTION public.ensure_notification_preferences()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.user_id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_notification_prefs ON public.profiles;
CREATE TRIGGER on_profile_created_notification_prefs
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.ensure_notification_preferences();

-- RLS: your row is yours.
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users read own notification preferences"
  ON public.notification_preferences FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users update own notification preferences"
  ON public.notification_preferences FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users insert own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users insert own notification preferences"
  ON public.notification_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());
