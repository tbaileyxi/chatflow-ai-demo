-- THE INVITE CARD NEEDS THE ROOM'S PICTURE AND THE GAME.
--
-- get_invite_preview fed the /i/<code> page three things: room name, member
-- count, inviter. That was enough for a page you had already decided to open.
-- It is not enough for the preview card in a text thread, which is the thing
-- that decides whether anyone opens it at all — there the card has to show the
-- room's own photo when it has one, and say which game.
--
-- The room's game is the same question useLiveGameContext answers in the app:
-- an explicit game_id if the room has one, otherwise the team's live game, and
-- failing that the next one on the schedule. Same ordering here so the card
-- and the room never disagree.
--
-- Still SECURITY DEFINER and still granted to anon: a person holding a live
-- invite code sees the room's name, its picture, how many are in it, who asked
-- them, and the fixture. Nothing about the members and nothing that was said.

drop function if exists public.get_invite_preview(text);

create function public.get_invite_preview(p_invite_code text)
returns table (
  huddle_name    text,
  member_count   integer,
  inviter_name   text,
  room_photo_url text,
  home_team      text,
  away_team      text,
  home_short     text,
  away_short     text,
  home_score     integer,
  away_score     integer,
  game_status    text,
  game_start     timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    h.name                             as huddle_name,
    coalesce(h.member_count, 0)        as member_count,
    p.display_name                     as inviter_name,
    h.photo_url                        as room_photo_url,
    nullif(trim(coalesce(ht.city, '') || ' ' || coalesce(ht.name, '')), '') as home_team,
    nullif(trim(coalesce(at.city, '') || ' ' || coalesce(at.name, '')), '') as away_team,
    ht.name                            as home_short,
    at.name                            as away_short,
    g.home_score,
    g.away_score,
    g.status                           as game_status,
    g.start_time                       as game_start
  from public.room_invites ri
  join public.huddles h on h.id = ri.huddle_id
  left join public.profiles p on p.user_id = ri.inviter_id
  -- The one fixture this room is about, if there is one.
  left join lateral (
    select gg.*
      from public.games gg
     where (h.game_id is not null and gg.id = h.game_id)
        or (
          h.game_id is null
          and h.team_id is not null
          and (gg.home_team_id = h.team_id or gg.away_team_id = h.team_id)
          -- A game that started more than nine hours ago is over, whatever the
          -- status column says; more than a week out is not this invite.
          and gg.start_time > now() - interval '9 hours'
          and gg.start_time < now() + interval '8 days'
        )
     order by
       (h.game_id is not null and gg.id = h.game_id) desc,
       (gg.status = 'in_progress') desc,
       gg.start_time
     limit 1
  ) g on true
  left join public.teams ht on ht.id = g.home_team_id
  left join public.teams at on at.id = g.away_team_id
  where ri.invite_code = p_invite_code
    and (ri.expires_at is null or ri.expires_at > now())
  limit 1;
$$;

revoke all on function public.get_invite_preview(text) from public;
grant execute on function public.get_invite_preview(text) to anon, authenticated;
