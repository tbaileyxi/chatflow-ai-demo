-- ============================================================
-- Side Huddle: friend graph + presence fix + friend-scoped search
-- Paste this whole file into the Supabase SQL editor and Run.
-- Safe to run more than once.
-- ============================================================


-- ==================== 20260820000001_presence_recipient_throttle.sql ====================

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

-- ==================== 20260820000002_friend_graph_v2.sql ====================

-- Friend graph v2 — the persistent "people you know" layer.
--
-- Until now "friends" were DERIVED from current room co-membership
-- (useFriends.ts, co_huddlers()), which means the graph is a lagging indicator:
-- it can only describe people already in a room with you, and everyone
-- disappears from it the moment a room empties. That is why a new user is
-- invisible to everyone and sees nobody.
--
-- This makes friend_connections the real graph (it existed but was written by
-- accept_room_invite and read by nothing), seeds it from the co-membership that
-- already exists so nobody loses their current people, and adds contact
-- matching on hashed phone/email so you can find people BEFORE sharing a room.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. Match keys. We store HASHES, never raw contact data from
--    anyone's address book.
-- ============================================================

-- phone_hash derives from the number the user gave us, so it can never drift
-- out of sync with phone_number.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_hash TEXT
  GENERATED ALWAYS AS (
    CASE
      WHEN phone_number IS NULL OR phone_number = '' THEN NULL
      ELSE encode(digest(phone_number, 'sha256'), 'hex')
    END
  ) STORED;

-- email_hash can't be generated: email lives in auth.users, not profiles.
-- Backfilled below and kept fresh by a trigger.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_phone_hash
  ON public.profiles(phone_hash) WHERE phone_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_email_hash
  ON public.profiles(email_hash) WHERE email_hash IS NOT NULL;

-- Normalise before hashing so the two sides agree: lowercase, trimmed.
CREATE OR REPLACE FUNCTION public.hash_email(p_email text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_email IS NULL OR btrim(p_email) = '' THEN NULL
    ELSE encode(digest(lower(btrim(p_email)), 'sha256'), 'hex')
  END;
$$;

UPDATE public.profiles p
   SET email_hash = public.hash_email(u.email)
  FROM auth.users u
 WHERE u.id = p.user_id
   AND p.email_hash IS DISTINCT FROM public.hash_email(u.email);

CREATE OR REPLACE FUNCTION public.sync_profile_email_hash()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  UPDATE public.profiles
     SET email_hash = public.hash_email(NEW.email)
   WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_hash ON auth.users;
CREATE TRIGGER on_auth_user_email_hash
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_email_hash();

-- ============================================================
-- 2. Seed the graph from co-membership that already exists.
--    Everyone who shares a room today becomes a connection, so
--    switching the app off the derived graph loses nobody.
-- ============================================================

INSERT INTO public.friend_connections (requester_id, addressee_id, status, source, accepted_at)
SELECT DISTINCT
  LEAST(a.user_id, b.user_id),
  GREATEST(a.user_id, b.user_id),
  'accepted',
  'room_presence',
  now()
FROM public.huddle_members a
JOIN public.huddle_members b
  ON a.huddle_id = b.huddle_id
 AND a.user_id < b.user_id
-- Skip the big public rooms: sharing a 200-person team room is not knowing
-- someone, and seeding from it would make everyone "friends" with everyone.
JOIN public.huddles h
  ON h.id = a.huddle_id
 AND COALESCE(h.is_official_team_huddle, false) = false
 AND COALESCE(h.member_count, 0) <= 25
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. known_people() — your graph, for Friends Now and any
--    friend-scoped discovery. Replaces the derived-from-rooms
--    query in useFriends.ts.
-- ============================================================

CREATE OR REPLACE FUNCTION public.known_people()
RETURNS TABLE (
  user_id uuid,
  display_name text,
  username text,
  avatar_url text,
  source text,
  connected_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    p.user_id,
    p.display_name,
    p.username,
    p.avatar_url,
    fc.source,
    COALESCE(fc.accepted_at, fc.created_at)
  FROM public.friend_connections fc
  JOIN public.profiles p
    ON p.user_id = CASE
         WHEN fc.requester_id = auth.uid() THEN fc.addressee_id
         ELSE fc.requester_id
       END
  WHERE (fc.requester_id = auth.uid() OR fc.addressee_id = auth.uid())
    AND fc.status = 'accepted'
  ORDER BY COALESCE(fc.accepted_at, fc.created_at) DESC;
$$;

GRANT EXECUTE ON FUNCTION public.known_people() TO authenticated;

-- ============================================================
-- 4. Contact matching. The client hashes its address book on the
--    device and sends ONLY hashes — raw numbers and emails never
--    leave the phone and are never stored.
-- ============================================================

CREATE OR REPLACE FUNCTION public.match_contacts(p_hashes text[])
RETURNS TABLE (
  user_id uuid,
  display_name text,
  username text,
  avatar_url text,
  already_connected boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    p.user_id,
    p.display_name,
    p.username,
    p.avatar_url,
    EXISTS (
      SELECT 1 FROM public.friend_connections fc
      WHERE fc.status = 'accepted'
        AND ((fc.requester_id = auth.uid() AND fc.addressee_id = p.user_id)
          OR (fc.addressee_id = auth.uid() AND fc.requester_id = p.user_id))
    )
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND p.user_id <> auth.uid()
    AND (p.phone_hash = ANY(p_hashes) OR p.email_hash = ANY(p_hashes))
  -- Cap the response so a caller can't page the whole user table by
  -- submitting a giant hash list.
  LIMIT 200;
$$;

GRANT EXECUTE ON FUNCTION public.match_contacts(text[]) TO authenticated;

-- ============================================================
-- 5. connect_to(user_id) — accept a match into the graph.
--    Symmetric and idempotent: the unique pair index means
--    connecting twice, in either direction, is a no-op.
-- ============================================================

CREATE OR REPLACE FUNCTION public.connect_to(p_user_id uuid, p_source text DEFAULT 'contact')
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING errcode = '42501';
  END IF;
  IF p_user_id = auth.uid() THEN
    RETURN;
  END IF;

  INSERT INTO public.friend_connections
    (requester_id, addressee_id, status, source, accepted_at)
  VALUES
    (auth.uid(), p_user_id, 'accepted',
     CASE WHEN p_source IN ('invite_link','contact','manual','room_presence')
          THEN p_source ELSE 'manual' END,
     now())
  ON CONFLICT DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.connect_to(uuid, text) TO authenticated;

-- ==================== 20260820000003_notification_types_friend_joined.sql ====================

-- Two notification types the product already produces but the CHECK constraint
-- rejected, so they could only ever be delivered as a push banner:
--
--   friend_joined — someone you know is now on Side Huddle. This is the signal
--                   that was missing entirely: people joined and nobody who
--                   knew them ever found out.
--   huddle_ping   — "Rally the huddle" fired a push but wrote no in-app row,
--                   so a dismissed banner meant the rally never happened as far
--                   as the recipient could tell.

ALTER TABLE public.notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
ADD CONSTRAINT notifications_type_check
CHECK (
  type IN (
    'game_start',
    'score_update',
    'game_end',
    'period_change',
    'presence_active',
    'new_message',
    'member_joined',
    'room_invite',
    'bot_drop',
    'kalshi_closing',
    'pick_result',
    'friend_joined',
    'huddle_ping'
  )
);

-- ==================== 20260820000004_friend_scoped_discovery.sql ====================

-- Friend-scoped discovery — the half that makes rooms "semi-private".
--
-- The model is: rooms are public by default, but you only ever SEE one if
-- somebody you know is in it. That is a discovery rule, not an access rule —
-- no lock on the door, you just can't find the door unless you know someone
-- inside. It is what makes a friend room feel private without it actually
-- being locked.
--
-- Today the search screen lists every non-official room ordered by member
-- count, which is the opposite: 206 rooms, all strangers, fully browsable.
-- That happened because there was no friend graph to scope with, so "show
-- everything" was the only option. There is one now.
--
-- Official team rooms are always visible: they are the public square, and the
-- thing that stops a brand-new user with no connections from seeing a blank
-- screen.

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
  -- Everyone I know, from the persistent graph.
  my_people AS (
    SELECT CASE
             WHEN fc.requester_id = (SELECT uid FROM me) THEN fc.addressee_id
             ELSE fc.requester_id
           END AS user_id
    FROM public.friend_connections fc
    WHERE fc.status = 'accepted'
      AND ((SELECT uid FROM me) IN (fc.requester_id, fc.addressee_id))
  ),
  -- Which of my people are in which room, and their names for the subtitle.
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
    COALESCE(h.is_official_team_huddle, false),
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
    -- The rule: somebody I know is in there, OR it's an official team room,
    -- OR I'm already a member (never hide someone's own room from them).
    AND (
      k.huddle_id IS NOT NULL
      OR COALESCE(h.is_official_team_huddle, false) = true
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
  -- Rooms with people you know first, then the busiest.
  ORDER BY COALESCE(k.known_count, 0) DESC, COALESCE(h.member_count, 0) DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.discoverable_huddles(text, integer) TO authenticated;
