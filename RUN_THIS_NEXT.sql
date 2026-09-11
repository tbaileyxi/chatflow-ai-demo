-- Rooms for the teams you follow.
--
-- discoverable_huddles() answers "where do I know someone?" — the right rule
-- for Search, and the wrong one here. On a team you have chosen to follow, the
-- question is "what rooms exist for this team", and a public room qualifies
-- whether or not anybody you know is inside. Requiring a friend in the room
-- would make a followed team look like it has nothing going on, which is the
-- exact empty-shelf problem the follow was supposed to fix.
--
-- Visibility rule, deliberately simpler than discovery's:
--   * rooms you are already in       — any privacy
--   * public rooms for that team     — is_private = false
-- A private room you are not in never appears. That matches huddle_messages,
-- where anon read of a public room's chat is the browsing feature.

CREATE OR REPLACE FUNCTION public.huddles_for_teams(
  p_team_ids uuid[],
  p_limit    integer DEFAULT 60
)
RETURNS TABLE (
  id            uuid,
  name          text,
  bio           text,
  team_id       uuid,
  member_count  integer,
  is_private    boolean,
  is_official   boolean,
  is_team_room  boolean,
  is_member     boolean,
  last_message_at timestamptz,
  known_names   text[],
  known_count   integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH me AS (SELECT auth.uid() AS uid),
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
    h.team_id,
    COALESCE(h.member_count, 0)::integer,
    COALESCE(h.is_private, false),
    -- Two different things that were one flag. "Official" is the badge a paid
    -- or verified room wears. "Team room" is the auto-created community room
    -- for a team, which is a different animal and gets filtered out of the
    -- Teams tab — one per followed team, none of them with anybody in them.
    (COALESCE(h.is_official_team_huddle, false) OR h.official_status = 'active'),
    COALESCE(h.is_official_team_huddle, false),
    EXISTS (
      SELECT 1 FROM public.huddle_members hm2
      WHERE hm2.huddle_id = h.id AND hm2.user_id = (SELECT uid FROM me)
    ) AS is_member,
    h.last_message_at,
    COALESCE(k.known_names, ARRAY[]::text[]),
    COALESCE(k.known_count, 0)
  FROM public.huddles h
  LEFT JOIN known_in_room k ON k.huddle_id = h.id
  WHERE (SELECT uid FROM me) IS NOT NULL
    AND h.team_id = ANY(p_team_ids)
    AND (
      COALESCE(h.is_private, false) = false
      OR EXISTS (
        SELECT 1 FROM public.huddle_members hm3
        WHERE hm3.huddle_id = h.id AND hm3.user_id = (SELECT uid FROM me)
      )
    )
  -- Rooms you're in first, then where you know people, then the busiest.
  ORDER BY
    -- Repeat the expression rather than lean on the output alias: ORDER BY
    -- resolving to an output column is fine until someone adds an input
    -- parameter with the same name, and then it silently sorts by that.
    EXISTS (
      SELECT 1 FROM public.huddle_members hm4
      WHERE hm4.huddle_id = h.id AND hm4.user_id = (SELECT uid FROM me)
    ) DESC,
    COALESCE(k.known_count, 0) DESC,
    COALESCE(h.member_count, 0) DESC,
    h.last_message_at DESC NULLS LAST
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.huddles_for_teams(uuid[], integer) TO authenticated;

-- ============================================================
SELECT
  (SELECT count(*) FROM pg_proc WHERE proname = 'huddles_for_teams') AS fn_created,
  has_function_privilege('authenticated','public.huddles_for_teams(uuid[], integer)','EXECUTE') AS granted;
