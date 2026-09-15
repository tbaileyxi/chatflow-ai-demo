-- Demo cast for App Store screenshots.
--
-- Five fictional people, a side huddle with a conversation in it, and one of
-- them at a stadium. Everything is tagged so it can be removed in one go —
-- see the teardown at the bottom of this file.
--
-- NOT REAL PEOPLE. The names are invented and the avatars are the app's own
-- monogram circles, which is what a real user without a photo already sees.
--
-- Profiles reference auth.users, so the accounts have to exist there first.
-- They are created with no password and no email confirmation: nothing can
-- sign in as them, they only exist to be looked at.

do $$
declare
  v_me     uuid;
  v_room   uuid;
  v_ids    uuid[] := array[
    '11111111-0000-4000-8000-000000000001'::uuid,
    '11111111-0000-4000-8000-000000000002'::uuid,
    '11111111-0000-4000-8000-000000000003'::uuid,
    '11111111-0000-4000-8000-000000000004'::uuid,
    '11111111-0000-4000-8000-000000000005'::uuid
  ];
  v_names  text[] := array['Marcus Ellery','Dana Whitfield','Theo Barnes','Priya Raman','Cole Hutchins'];
  i int;
begin
  -- The account the screenshots are taken from: the App Store test login.
  select user_id into v_me from public.profiles
   where username like '12035550142%' limit 1;
  if v_me is null then
    raise exception 'demo account not found — sign in once as 203 555 0142 first';
  end if;

  update public.profiles set display_name = 'Ty' where user_id = v_me;

  for i in 1..5 loop
    insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
    values (v_ids[i], '00000000-0000-0000-0000-000000000000', 'authenticated',
            'authenticated', format('demo%s@sidehuddle.invalid', i), now(), now())
    on conflict (id) do nothing;

    insert into public.profiles (user_id, display_name, username, onboarding_completed)
    values (v_ids[i], v_names[i], format('demo_%s', i), true)
    on conflict (user_id) do update
      set display_name = excluded.display_name, onboarding_completed = true;

    -- Connected to the demo account, so they appear in Friends and can be
    -- pulled into a room.
    insert into public.friend_connections (requester_id, addressee_id, status, source, accepted_at)
    values (v_me, v_ids[i], 'accepted', 'manual', now())
    on conflict do nothing;
  end loop;

  -- A permanent side huddle — the core room, not a fixture room.
  -- Reuse the room if a previous run got partway. The whole block is one
  -- transaction so a failure rolls back, but re-running should not be able to
  -- leave two rooms with the same name either.
  select id into v_room from public.huddles where name = 'Sunday Section' limit 1;
  if v_room is null then
    insert into public.huddles (name, bio, owner_id, is_private, team_id)
    select 'Sunday Section', 'Same six of us every week since college.', v_me, false,
           (select id from public.teams where league = 'NFL' and name = 'Chiefs' limit 1)
    returning id into v_room;
  end if;

  -- ON CONFLICT DO NOTHING on every membership: creating a huddle already adds
  -- its owner via a trigger, so inserting the owner again is a unique
  -- violation — which is what killed the first run of this file.
  insert into public.huddle_members (huddle_id, user_id) values (v_room, v_me)
    on conflict do nothing;
  for i in 1..5 loop
    insert into public.huddle_members (huddle_id, user_id) values (v_room, v_ids[i])
      on conflict do nothing;
  end loop;

  -- Re-running should not double the conversation.
  delete from public.huddle_messages where huddle_id = v_room;

  -- A conversation. Timestamps walk backwards so it reads in order.
  insert into public.huddle_messages (huddle_id, user_id, content, created_at) values
    (v_room, v_ids[1], 'anyone else watching this or is it just me losing my mind', now() - interval '14 minutes'),
    (v_room, v_ids[3], 'watching. that spot was NOT a first down', now() - interval '12 minutes'),
    (v_room, v_ids[2], 'they are not going to review it either', now() - interval '11 minutes'),
    (v_room, v_me,     'we get the ball back with two timeouts, we are fine', now() - interval '8 minutes'),
    (v_room, v_ids[4], 'love the optimism. genuinely.', now() - interval '7 minutes'),
    (v_room, v_ids[5], 'ok that throw was unreal', now() - interval '3 minutes'),
    (v_room, v_ids[1], 'TOLD YOU', now() - interval '2 minutes');

  -- One of them is at the game. Only people you are connected to can see this,
  -- and the demo account is connected to all five.
  insert into public.venue_presence (user_id, venue_id, until)
  select v_ids[2], v.id, now() + interval '3 hours'
    from public.venues v
    join public.teams t on t.id = v.team_id
   where t.league = 'NFL' and t.name = 'Chiefs'
   limit 1
  on conflict (user_id) do update set until = excluded.until;

  raise notice 'demo room: %', v_room;
end $$;

select
  (select count(*) from public.profiles where username like 'demo\_%') as demo_people,
  (select count(*) from public.huddles where name = 'Sunday Section')  as demo_room,
  (select count(*) from public.venue_presence)                          as at_stadium;


-- ── TEARDOWN — run this after the screenshots are taken ──────────────────────
-- delete from public.huddles where name = 'Sunday Section';
-- delete from auth.users where id::text like '11111111-0000-4000-8000-%';
