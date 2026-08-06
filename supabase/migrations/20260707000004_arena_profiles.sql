-- ProphetDome profiles: avatars (shown on the battlefield when you stake),
-- and follows (free follow button; paid copy-trading later via Square).

ALTER TABLE public.arena_players ADD COLUMN IF NOT EXISTS avatar text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS public.arena_follows (
  follower uuid NOT NULL,
  followed uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower, followed)
);
ALTER TABLE public.arena_follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "follows are public" ON public.arena_follows;
CREATE POLICY "follows are public"
  ON public.arena_follows FOR SELECT USING (true);
-- writes via RPCs only

CREATE OR REPLACE FUNCTION public.arena_set_avatar(p_client uuid, p_avatar text)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$
  UPDATE arena_players SET avatar = left(coalesce(p_avatar, ''), 4), updated_at = now()
  WHERE client_id = p_client;
$$;

CREATE OR REPLACE FUNCTION public.arena_toggle_follow(p_client uuid, p_target uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_following boolean;
BEGIN
  IF p_client = p_target THEN
    RAISE EXCEPTION 'cannot follow yourself';
  END IF;
  IF EXISTS (SELECT 1 FROM arena_follows WHERE follower = p_client AND followed = p_target) THEN
    DELETE FROM arena_follows WHERE follower = p_client AND followed = p_target;
    v_following := false;
  ELSE
    INSERT INTO arena_follows (follower, followed) VALUES (p_client, p_target);
    v_following := true;
  END IF;
  RETURN jsonb_build_object(
    'following', v_following,
    'followers', (SELECT count(*) FROM arena_follows WHERE followed = p_target)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.arena_set_avatar(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.arena_toggle_follow(uuid, uuid) TO anon, authenticated;
