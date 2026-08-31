-- URGENT: nobody can create an account.
--
-- "Database error saving new user" on sign-up. The cause is a trigger added by
-- 20260820000002_friend_graph_v2.sql, so this has been broken since Aug 20 —
-- it only surfaced now because no new account had been created since.
--
-- WHAT HAPPENS. Inserting an auth user fires on_auth_user_email_hash, which
-- runs sync_profile_email_hash with `SET search_path = ''`. That calls
-- public.hash_email, which calls digest() UNQUALIFIED. digest lives in the
-- `extensions` schema, and with an empty search_path it cannot be resolved, so
-- the function raises, the trigger raises, and the whole INSERT is rolled back.
--
-- TWO THINGS ARE WRONG and both are fixed below.
--
--   1. The unqualified call. Now extensions.digest, which resolves whatever the
--      search_path happens to be.
--
--   2. More important: a contact-matching convenience was able to block account
--      creation. An AFTER INSERT trigger that raises takes the insert with it.
--      Hashing an email so friends can find each other is worth nothing next to
--      being able to sign up, so it now swallows its own failures and logs
--      instead. The hash is backfilled on next login by the same trigger's
--      UPDATE path, and by the backfill at the bottom of this file.
--
-- Run in the Supabase SQL editor. Safe to run twice.

-- ── 1. resolve digest no matter what the search_path is ──────────────────────
CREATE OR REPLACE FUNCTION public.hash_email(p_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_email IS NULL OR btrim(p_email) = '' THEN NULL
    ELSE encode(extensions.digest(lower(btrim(p_email)), 'sha256'), 'hex')
  END;
$$;


-- ── 2. never let this stop somebody signing up ───────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_profile_email_hash()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  BEGIN
    UPDATE public.profiles
       SET email_hash = public.hash_email(NEW.email)
     WHERE user_id = NEW.id;
  EXCEPTION WHEN OTHERS THEN
    -- Losing a hash costs one person one contact match. Raising here costs
    -- everybody their account.
    RAISE WARNING '[sync_profile_email_hash] skipped for %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;


-- ── 3. same trap, same fix: the profile row itself ───────────────────────────
-- handle_new_user is what actually creates the profile. If it raises, sign-up
-- dies the same way, and it runs with SET search_path = '' too.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id, display_name, username, phone_number, signup_method, last_login_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', 'User'),
    COALESCE(
      NEW.raw_user_meta_data ->> 'username',
      SPLIT_PART(COALESCE(NEW.email, NEW.phone), '@', 1) || '_' ||
        SUBSTRING(NEW.id::text FROM 1 FOR 8)
    ),
    COALESCE(NEW.phone, NEW.raw_user_meta_data ->> 'phone_number'),
    CASE WHEN NEW.phone IS NOT NULL THEN 'phone' ELSE 'email' END,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    phone_number  = EXCLUDED.phone_number,
    last_login_at = EXCLUDED.last_login_at;

  RETURN NEW;
END;
$$;


-- ── 4. backfill anyone who signed up while it was broken ─────────────────────
UPDATE public.profiles p
   SET email_hash = public.hash_email(u.email)
  FROM auth.users u
 WHERE u.id = p.user_id
   AND p.email_hash IS DISTINCT FROM public.hash_email(u.email);


-- ── 5. check ─────────────────────────────────────────────────────────────────
-- hash_length should be 64 (a sha256 hex digest). Anything else and the
-- extensions schema is not where digest lives on this project.
SELECT
  length(public.hash_email('test@example.com'))                    AS hash_length,
  (SELECT count(*) FROM public.profiles WHERE email_hash IS NOT NULL) AS profiles_hashed,
  (SELECT count(*) FROM public.profiles)                           AS profiles_total;
