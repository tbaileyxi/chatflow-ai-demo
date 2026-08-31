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
