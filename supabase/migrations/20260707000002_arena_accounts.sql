-- ProphetDome accounts — "save your record". Anonymous entry stays the
-- default; signing in (Supabase email magic link) binds the device's
-- client_id to the auth user. Later devices adopt the account's canonical
-- record; their fresh anonymous chips are DISCARDED on merge (otherwise
-- start-bankroll farming), but their stakes history is repointed.

ALTER TABLE public.arena_players ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS arena_players_user_idx
  ON public.arena_players (user_id) WHERE user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.arena_link_account(p_client uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_canon arena_players;
  v_cur arena_players;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in';
  END IF;
  SELECT * INTO v_canon FROM arena_players WHERE user_id = v_uid;
  SELECT * INTO v_cur FROM arena_players WHERE client_id = p_client;

  IF v_canon.client_id IS NOT NULL THEN
    -- account already has a canonical record: this device adopts it
    IF v_cur.client_id IS NOT NULL AND v_cur.user_id IS NULL
       AND v_cur.client_id <> v_canon.client_id THEN
      UPDATE arena_stakes SET client_id = v_canon.client_id
      WHERE client_id = v_cur.client_id;
      DELETE FROM arena_players WHERE client_id = v_cur.client_id;
    END IF;
    RETURN jsonb_build_object('client_id', v_canon.client_id);
  END IF;

  -- first link: this device's record becomes the account's canonical record
  IF v_cur.client_id IS NULL THEN
    INSERT INTO arena_players (client_id, user_id) VALUES (p_client, v_uid);
  ELSE
    UPDATE arena_players SET user_id = v_uid, updated_at = now()
    WHERE client_id = p_client;
  END IF;
  RETURN jsonb_build_object('client_id', p_client);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.arena_link_account(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.arena_link_account(uuid) TO authenticated;
