-- WHO IS ACTUALLY THE CREATOR.
--
-- The auto-pull may only post into a room whose admin IS the X creator being
-- pulled. Until now nothing recorded that: rooms carried an x_handle and an
-- owner, and no row said "this user is @DaBearsBlog" — so the rule could not be
-- checked, and a room owned by anyone could have any account wired into it.
--
-- One row per verified creator. NO client policies at all: only the service
-- role (the mirror, or an admin in the SQL editor) can read or write it. If a
-- user could set their own handle here, they could claim a creator's handle and
-- mirror that creator's posts into a room of their own.
CREATE TABLE IF NOT EXISTS public.creator_accounts (
  user_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  x_handle    text NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS creator_accounts_handle
  ON public.creator_accounts (lower(x_handle));

ALTER TABLE public.creator_accounts ENABLE ROW LEVEL SECURITY;
