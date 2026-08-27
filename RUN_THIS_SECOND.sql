-- ============================================================
-- Side Huddle, part 2: notification controls + paid rooms in search
-- Paste the whole file into the Supabase SQL editor and Run.
-- Safe to run more than once. Includes the premium-search file
-- from earlier, so this replaces it if you have not run that yet.
-- ============================================================


-- ==================== 20260820000005_discoverable_includes_premium.sql ====================

-- Add paid rooms to discovery.
--
-- The rule is "you see a room if somebody you know is in it" — plus the rooms
-- that ASKED to be found. Team rooms were already in. Premium rooms
-- (official_status = 'active') were not, which is backwards: they are paying
-- precisely to be discoverable by people who don't know anyone inside yet.
--
-- Everything else is unchanged from 20260820000004.

CREATE OR REPLACE FUNCTION public.discoverable_huddles(
  p_search text DEFAULT NULL,
  p_limit  integer DEFAULT 40
)
RETURNS TABLE (
  id             uuid,
  name           text,
  bio            text,
  member_count   integer,
  team_name      text,
  team_logo_url  text,
  is_private     boolean,
  is_official    boolean,
  is_member      boolean,
  known_names    text[],
  known_count    integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH me AS (
    SELECT auth.uid() AS uid
  ),
  my_people AS (
    SELECT CASE
             WHEN fc.requester_id = (SELECT uid FROM me) THEN fc.addressee_id
             ELSE fc.requester_id
           END AS user_id
    FROM public.friend_connections fc
    WHERE fc.status = 'accepted'
      AND ((SELECT uid FROM me) IN (fc.requester_id, fc.addressee_id))
  ),
  known_in_room AS (
    SELECT
      hm.huddle_id,
      count(*)::int AS known_count,
      (array_agg(
         COALESCE(p.display_name, p.username, 'Someone')
         ORDER BY COALESCE(p.display_name, p.username)
       ))[1:3] AS known_names
    FROM public.huddle_members hm
    JOIN my_people mp ON mp.user_id = hm.user_id
    LEFT JOIN public.profiles p ON p.user_id = hm.user_id
    GROUP BY hm.huddle_id
  )
  SELECT
    h.id,
    h.name,
    h.bio,
    COALESCE(h.member_count, 0)::integer,
    t.name,
    t.logo_url,
    COALESCE(h.is_private, false),
    -- "Official" badge covers both the team rooms and the paid ones.
    (COALESCE(h.is_official_team_huddle, false) OR h.official_status = 'active'),
    EXISTS (
      SELECT 1 FROM public.huddle_members hm2
      WHERE hm2.huddle_id = h.id AND hm2.user_id = (SELECT uid FROM me)
    ),
    COALESCE(k.known_names, ARRAY[]::text[]),
    COALESCE(k.known_count, 0)
  FROM public.huddles h
  LEFT JOIN public.teams t ON t.id = h.team_id
  LEFT JOIN known_in_room k ON k.huddle_id = h.id
  WHERE (SELECT uid FROM me) IS NOT NULL
    AND (
      -- somebody I know is in there
      k.huddle_id IS NOT NULL
      -- or the room asked to be found: team room, or paid
      OR COALESCE(h.is_official_team_huddle, false) = true
      OR h.official_status = 'active'
      -- or it's already mine
      OR EXISTS (
        SELECT 1 FROM public.huddle_members hm3
        WHERE hm3.huddle_id = h.id AND hm3.user_id = (SELECT uid FROM me)
      )
    )
    AND (
      p_search IS NULL
      OR btrim(p_search) = ''
      OR h.name ILIKE '%' || btrim(p_search) || '%'
      OR t.name ILIKE '%' || btrim(p_search) || '%'
    )
  ORDER BY COALESCE(k.known_count, 0) DESC, COALESCE(h.member_count, 0) DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.discoverable_huddles(text, integer) TO authenticated;

-- ==================== 20260820000006_notification_preferences_v2.sql ====================

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
