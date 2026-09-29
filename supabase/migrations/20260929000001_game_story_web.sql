-- A game story that plays outside the app.
--
-- Sharing was a card and a wall: the link previewed nicely and then offered a
-- download, and whoever tapped it could never watch the thing they were sent
-- unless they were already in that room. A share nobody can open is not a
-- share, and sharing is the whole reason the story exists.
--
-- So one function returns a story to an anonymous browser. It is deliberately
-- the ONLY way out: the app reads the thread directly and always could, and
-- this exists so a link can be worth tapping.
--
-- WHAT GOVERNS IT. huddles.story_shareable decides whether a room's story
-- leaves the app at all. An open room defaults to true, because distribution
-- is the point and a story of a game everyone watched is not a secret. A
-- private room defaults to FALSE — not because private rooms should not have
-- stories, they should and do inside the app, but because a room somebody
-- deliberately locked should not become playable by anyone holding a URL
-- without its owner saying so. The owner can turn it on.
--
-- WHAT IT RETURNS. Public storage URLs that are already fetchable by anyone
-- who has them; this hands over the LIST, which is the part that was never
-- public. No user ids, no emails, no message ids — a display name per item,
-- because a story with no names is a slideshow.

alter table public.huddles
  add column if not exists story_shareable boolean;

comment on column public.huddles.story_shareable is
  'Null means "decide from is_private": open rooms share, locked rooms do not.';

create or replace function public.game_story(p_huddle_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_room   record;
  v_game   record;
  v_from   timestamptz;
  v_to     timestamptz;
  v_items  jsonb;
  v_people integer;
begin
  select h.id, h.name, h.team_id, h.photo_url,
         coalesce(h.is_private, false) as is_private,
         h.story_shareable
    into v_room
    from public.huddles h
   where h.id = p_huddle_id;

  if not found then
    return jsonb_build_object('found', false);
  end if;

  -- Explicit setting wins; otherwise a locked room keeps its story in.
  if coalesce(v_room.story_shareable, not v_room.is_private) is not true then
    return jsonb_build_object(
      'found', true, 'shareable', false, 'room', v_room.name);
  end if;

  -- The last game this team actually played. A week, not the nine hours the
  -- app uses: a link shared on Saturday is opened on Sunday, and a story that
  -- expires before the group chat gets to it was never shareable.
  select g.* into v_game
    from public.games g
   where (g.home_team_id = v_room.team_id or g.away_team_id = v_room.team_id)
     and lower(coalesce(g.status, '')) in ('final', 'completed', 'closed')
     and g.start_time > now() - interval '7 days'
   order by g.start_time desc
   limit 1;

  if not found then
    return jsonb_build_object(
      'found', true, 'shareable', true, 'room', v_room.name, 'items', '[]'::jsonb);
  end if;

  -- Same window the app draws: kickoff to a while past the whistle, because
  -- the shots worth keeping are taken once it is over.
  v_from := v_game.start_time;
  v_to   := coalesce(v_game.went_final_at + interval '3 hours',
                     v_game.start_time + interval '9 hours');

  select
      coalesce(jsonb_agg(x order by x.created_at), '[]'::jsonb),
      count(distinct x.user_id)
    into v_items, v_people
  from (
    select m.created_at,
           m.user_id,
           m.media_url  as url,
           m.media_type as kind,
           nullif(trim(m.content), '') as caption,
           p.display_name as author
      from public.huddle_messages m
      left join public.profiles p on p.user_id = m.user_id
     where m.huddle_id = p_huddle_id
       and m.media_url is not null
       and m.media_type in ('image', 'video')
       and coalesce(m.is_bot_message, false) = false
       and m.created_at between v_from and v_to
  ) x;

  return jsonb_build_object(
    'found', true,
    'shareable', true,
    'room', v_room.name,
    'roomPhoto', v_room.photo_url,
    'people', coalesce(v_people, 0),
    'game', jsonb_build_object(
      'homeScore', v_game.home_score,
      'awayScore', v_game.away_score,
      'startTime', v_game.start_time
    ),
    'items', v_items
  );
end $$;

revoke all on function public.game_story(uuid) from public;
grant execute on function public.game_story(uuid) to anon, authenticated;
