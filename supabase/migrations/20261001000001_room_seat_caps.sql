-- Capped rooms, and the seat that gets you in without asking.
--
-- The cap is the product, not a limit on it. Fifty people where somebody
-- might answer you is a different thing from ten thousand where nobody can,
-- and the number is what makes the difference real. Hosts choose it; we do
-- not choose it for them.
--
-- It also quietly fixes the entry problem. Up to now getting into a room you
-- were not invited to meant asking, and somebody had to be looking at their
-- phone mid-game to let you in. A seat is self-serve: claim it and you are
-- in, until they run out.
--
-- ENFORCED BY A TRIGGER, NOT BY THE SCREENS. People become members through
-- JoinHuddleScreen, through accept_room_invite, through the pull-in sheet and
-- through room creation, and a check written into one of those is a check the
-- other three walk past. The lock on the huddles row is what makes two people
-- claiming the last seat at the same instant resolve to one winner rather
-- than fifty-one members.

alter table public.huddles
  add column if not exists seat_cap integer
  check (seat_cap is null or seat_cap > 0);

comment on column public.huddles.seat_cap is
  'Null means no cap, which is every room that existed before this.';

create or replace function public.enforce_seat_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cap   integer;
  v_owner uuid;
  v_taken integer;
begin
  -- FOR UPDATE serialises concurrent claims on the same room. Without it two
  -- people reading "49 of 50" both pass the check and both get in.
  select h.seat_cap, h.owner_id into v_cap, v_owner
    from public.huddles h
   where h.id = new.huddle_id
     for update;

  if v_cap is null then return new; end if;
  -- The host is never locked out of their own room, whatever they set.
  if new.user_id = v_owner then return new; end if;

  select count(*) into v_taken
    from public.huddle_members m
   where m.huddle_id = new.huddle_id;

  if v_taken >= v_cap then
    -- Caught by name in the app and shown as "sold out" rather than an error.
    raise exception 'room_full' using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists enforce_seat_cap on public.huddle_members;
create trigger enforce_seat_cap
  before insert on public.huddle_members
  for each row execute function public.enforce_seat_cap();

-- Search has to say how many seats are left, because "sold out" is the whole
-- point of a cap and cannot be shown from a member count alone. Same body as
-- friend_scoped_discovery, with seat_cap on the end: the discovery rule is
-- untouched, there is just one more column to read it by.
drop function if exists public.discoverable_huddles(text, integer);

CREATE FUNCTION public.discoverable_huddles(
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
  known_count    integer,
  seat_cap       integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
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
    COALESCE(h.is_official_team_huddle, false),
    EXISTS (
      SELECT 1 FROM public.huddle_members hm2
      WHERE hm2.huddle_id = h.id AND hm2.user_id = (SELECT uid FROM me)
    ),
    COALESCE(k.known_names, ARRAY[]::text[]),
    COALESCE(k.known_count, 0),
    h.seat_cap
  FROM public.huddles h
  LEFT JOIN public.teams t ON t.id = h.team_id
  LEFT JOIN known_in_room k ON k.huddle_id = h.id
  WHERE (SELECT uid FROM me) IS NOT NULL
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
  ORDER BY COALESCE(k.known_count, 0) DESC, COALESCE(h.member_count, 0) DESC
  LIMIT p_limit;
$fn$;

GRANT EXECUTE ON FUNCTION public.discoverable_huddles(text, integer) TO authenticated;

-- Whether a host actually answers anyone.
--
-- If access is what a seat buys, this is the only quality signal that
-- matters, and it needs no new table — a reply is already a message with
-- reply_to_id pointing at somebody else's. Logged nowhere, derived on
-- demand, so it costs nothing until someone asks.
create or replace function public.host_reply_rate(p_huddle_id uuid, p_days integer default 7)
returns table (host_messages integer, replies integer, people_answered integer)
language sql
security definer
set search_path = public
stable
as $$
  with host as (
    select owner_id from public.huddles where id = p_huddle_id
  ),
  mine as (
    select m.id, m.reply_to_id
      from public.huddle_messages m, host
     where m.huddle_id = p_huddle_id
       and m.user_id = host.owner_id
       and coalesce(m.is_bot_message, false) = false
       and m.created_at > now() - make_interval(days => greatest(p_days, 1))
  )
  select
    (select count(*) from mine)::integer,
    (select count(*) from mine x
       join public.huddle_messages p on p.id = x.reply_to_id, host
      where p.user_id <> host.owner_id)::integer,
    (select count(distinct p.user_id) from mine x
       join public.huddle_messages p on p.id = x.reply_to_id, host
      where p.user_id <> host.owner_id)::integer;
$$;

revoke all on function public.host_reply_rate(uuid, integer) from public, anon;
grant execute on function public.host_reply_rate(uuid, integer) to authenticated;
