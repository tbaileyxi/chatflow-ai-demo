-- The partner travels with the story, so the video can carry them.
--
-- "Powered by" under a download button reaches nobody: the moment the file
-- is on somebody's phone, every surface we own is behind it. If reach is
-- what a partner is buying, the partner has to be IN the thing that travels,
-- which means two seconds at the end of the rendered video — and the renderer
-- cannot draw a name the page was never told.
--
-- ONLY WHEN THERE IS A PARTNER. No row, no name, no card, and the video ends
-- the way it does today. Nobody gets an advert for an empty slot.
--
-- THE SLUG IS THE JOIN AND IT IS FRAGILE. founding_partners keys on
-- slugify(city || ' ' || name) — "cleveland-browns" — which is what
-- sponsor-pregame-card computes and what square-webhook writes from the
-- claim's team_name (the sponsor page sends "${city} ${name}", so the two
-- agree). Derived here the same way on purpose: a slug built differently
-- fails by finding nothing, which looks exactly like having no sponsor.

create or replace function public.game_story(p_huddle_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_room    record;
  v_game    record;
  v_from    timestamptz;
  v_to      timestamptz;
  v_items   jsonb;
  v_people  integer;
  v_partner text;
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

  -- This season's partner for the room's team, if there is one.
  select fp.partner_name into v_partner
    from public.teams t
    join public.founding_partners fp
      on fp.team_slug = regexp_replace(
           regexp_replace(
             lower(btrim(coalesce(t.city, '') || ' ' || coalesce(t.name, ''))),
             '[^a-z0-9]+', '-', 'g'),
           '(^-)|(-$)', '', 'g')
     and fp.season = date_part('year', now())::integer
   where t.id = v_room.team_id;

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
    'partner', v_partner,
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
