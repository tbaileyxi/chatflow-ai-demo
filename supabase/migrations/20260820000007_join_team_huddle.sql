-- join_team_huddle(team_id) — where an uninvited signup lands.
--
-- The model: if you arrive by invite you land in that room; if you arrive cold
-- you land in your team's single open room. Onboarding never did the second
-- half, so every uninvited signup finished setup with zero rooms — an empty
-- app, invisible to everyone.
--
-- SECURITY DEFINER because it may need to CREATE the team room. That can't be
-- a client insert: huddles.owner_id must equal auth.uid(), which would make the
-- first person to pick a team the owner of that team's public room. Ownership
-- goes to the system user instead.

CREATE OR REPLACE FUNCTION public.join_team_huddle(p_team_id uuid)
RETURNS TABLE (huddle_id uuid, created boolean, already_member boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_huddle_id uuid;
  v_created boolean := false;
  v_already boolean := false;
  v_system_user uuid;
  v_team_name text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING errcode = '42501';
  END IF;

  SELECT name INTO v_team_name FROM public.teams WHERE id = p_team_id;
  IF v_team_name IS NULL THEN
    RAISE EXCEPTION 'unknown team' USING errcode = '02000';
  END IF;

  -- The team's open room. Oldest wins if duplicates ever crept in, so everyone
  -- picking the same team keeps converging on one room.
  SELECT id INTO v_huddle_id
  FROM public.huddles
  WHERE team_id = p_team_id
    AND is_official_team_huddle IS TRUE
  ORDER BY created_at
  LIMIT 1;

  IF v_huddle_id IS NULL THEN
    v_system_user := public.get_or_create_system_user();

    INSERT INTO public.huddles
      (name, owner_id, team_id, is_private, is_official_team_huddle,
       is_verified, member_count)
    VALUES
      (v_team_name, v_system_user, p_team_id, false, true, true, 0)
    RETURNING id INTO v_huddle_id;

    v_created := true;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.huddle_members
    WHERE huddle_members.huddle_id = v_huddle_id
      AND huddle_members.user_id = v_user_id
  ) INTO v_already;

  IF NOT v_already THEN
    INSERT INTO public.huddle_members (huddle_id, user_id)
    VALUES (v_huddle_id, v_user_id)
    ON CONFLICT DO NOTHING;
  END IF;

  huddle_id := v_huddle_id;
  created := v_created;
  already_member := v_already;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_team_huddle(uuid) TO authenticated;
