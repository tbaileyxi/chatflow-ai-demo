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
