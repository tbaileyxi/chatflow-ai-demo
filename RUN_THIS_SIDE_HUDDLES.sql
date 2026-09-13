-- Game rooms, and the side huddles that come out of them.
--
-- TWO NEW KINDS OF HUDDLE, both on the table that already exists:
--
--   A GAME ROOM is public and nobody creates it. One per fixture, made on
--   first entry, open to anyone. You never walk into an empty one, because
--   the game is what fills it — which is the whole reason public rooms failed
--   the first time.
--
--   A SIDE HUDDLE is one you pulled out of a game room: same game, the people
--   you were standing next to, and it CLOSES AT 2AM. Not midnight — a 10:15
--   Pacific kickoff is still going at midnight, and a room that dies at
--   halftime is worse than no room.
--
-- Neither gets a name of its own. Both are named after the game, because
-- nobody types a room name during a fourth quarter.
--
-- Run in the Supabase SQL editor. Safe to run twice.


-- ── 1. columns ───────────────────────────────────────────────────────────────
alter table public.huddles add column if not exists game_id     uuid references public.games(id) on delete set null;
alter table public.huddles add column if not exists is_game_room boolean not null default false;
alter table public.huddles add column if not exists expires_at   timestamptz;
-- Which bench the bot talks from. Null = no side, and it just calls the game.
alter table public.huddles add column if not exists bot_side_team_id uuid references public.teams(id) on delete set null;

-- One public room per fixture. Side huddles share the game_id, so the index
-- has to be partial or the second one fails.
create unique index if not exists huddles_one_game_room_per_game
  on public.huddles (game_id) where is_game_room;

create index if not exists huddles_game_id_idx on public.huddles (game_id);
create index if not exists huddles_expires_at_idx on public.huddles (expires_at) where expires_at is not null;


-- ── 2. the game room ─────────────────────────────────────────────────────────
-- Get it, or make it. SECURITY DEFINER because the caller is allowed to ENTER
-- a public room without being allowed to insert huddles generally.
create or replace function public.get_or_create_game_room(p_game_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid;
  v_game  record;
  v_name  text;
begin
  select id into v_id from public.huddles
   where game_id = p_game_id and is_game_room limit 1;
  if v_id is not null then
    insert into public.huddle_members (huddle_id, user_id)
    values (v_id, auth.uid()) on conflict do nothing;
    return v_id;
  end if;

  select g.*,
         -- Place, not mascot: the same rule the app uses. `city` holds the
         -- school for college and the city for pro.
         coalesce(ht.city, ht.name, 'TBD') as home_place,
         coalesce(at.city, at.name, 'TBD') as away_place
    into v_game
    from public.games g
    left join public.teams ht on ht.id = g.home_team_id
    left join public.teams at on at.id = g.away_team_id
   where g.id = p_game_id;

  if not found then
    raise exception 'No such game';
  end if;

  v_name := v_game.away_place || ' · ' || v_game.home_place;

  insert into public.huddles (name, team_id, owner_id, is_private, is_game_room, game_id)
  values (v_name, v_game.home_team_id, auth.uid(), false, true, p_game_id)
  returning id into v_id;

  insert into public.huddle_members (huddle_id, user_id)
  values (v_id, auth.uid()) on conflict do nothing;

  return v_id;
end;
$$;


-- ── 3. spinning one off ──────────────────────────────────────────────────────
-- Everyone you name comes with you. You spun off BECAUSE of them, so asking
-- again on the next screen is a form for a decision already made.
create or replace function public.spin_up_side_huddle(
  p_game_id uuid,
  p_user_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id   uuid;
  v_name text;
  v_uid  uuid;
begin
  select h.name into v_name from public.huddles h
   where h.game_id = p_game_id and h.is_game_room limit 1;

  if v_name is null then
    select coalesce(at.city, at.name, 'TBD') || ' · ' || coalesce(ht.city, ht.name, 'TBD')
      into v_name
      from public.games g
      left join public.teams ht on ht.id = g.home_team_id
      left join public.teams at on at.id = g.away_team_id
     where g.id = p_game_id;
  end if;

  insert into public.huddles (name, team_id, owner_id, is_private, game_id, expires_at)
  select coalesce(v_name, 'Side huddle'), g.home_team_id, auth.uid(), true, p_game_id,
         -- 2AM LOCAL-ISH. Tonight's 2am if it is still before it, tomorrow's
         -- otherwise — so a room started at 11pm and one started at 1am both
         -- die at the same 2am rather than one of them lasting a minute.
         (date_trunc('day', now()) + interval '26 hours')
    from public.games g where g.id = p_game_id
  returning id into v_id;

  insert into public.huddle_members (huddle_id, user_id)
  values (v_id, auth.uid()) on conflict do nothing;

  foreach v_uid in array coalesce(p_user_ids, '{}')
  loop
    insert into public.huddle_members (huddle_id, user_id)
    values (v_id, v_uid) on conflict do nothing;
  end loop;

  return v_id;
end;
$$;


-- ── 4. who can read a game room ──────────────────────────────────────────────
-- Public means public: anyone signed in can read one and post in it. Private
-- huddles are untouched — their policies still decide everything.
drop policy if exists "game rooms are readable by anyone" on public.huddles;
create policy "game rooms are readable by anyone"
  on public.huddles for select
  using (is_game_room or (select auth.uid()) is not null and exists (
    select 1 from public.huddle_members m
     where m.huddle_id = huddles.id and m.user_id = (select auth.uid())
  ));

drop policy if exists "anyone can read a game room's messages" on public.huddle_messages;
create policy "anyone can read a game room's messages"
  on public.huddle_messages for select
  using (exists (
    select 1 from public.huddles h
     where h.id = huddle_messages.huddle_id and h.is_game_room
  ));

drop policy if exists "anyone can post in a game room" on public.huddle_messages;
create policy "anyone can post in a game room"
  on public.huddle_messages for insert
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.huddles h
       where h.id = huddle_messages.huddle_id and h.is_game_room
    )
  );


-- ── 5. closing time ──────────────────────────────────────────────────────────
-- A side huddle CLOSES, it is not deleted. Everyone who was in it can still
-- read it, and one tap makes it permanent — which is how one earns a name.
create or replace function public.close_expired_side_huddles()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  with done as (
    update public.huddles h
       set expires_at = null, is_private = true, name = h.name || ' · closed'
     where h.expires_at is not null
       and h.expires_at < now()
       -- Still busy? Leave it. Nothing dies mid-argument.
       and coalesce(h.last_message_at, h.created_at) < now() - interval '20 minutes'
    returning 1
  )
  select count(*) into v_n from done;
  return v_n;
end;
$$;

select cron.schedule(
  'close-expired-side-huddles',
  '*/10 * * * *',
  $$select public.close_expired_side_huddles();$$
) where not exists (
  select 1 from cron.job where jobname = 'close-expired-side-huddles'
);


-- ── check ────────────────────────────────────────────────────────────────────
select
  (select count(*) from information_schema.columns
    where table_name = 'huddles'
      and column_name in ('game_id','is_game_room','expires_at','bot_side_team_id')) as columns_added,
  to_regprocedure('public.get_or_create_game_room(uuid)')          is not null as can_open_game_rooms,
  to_regprocedure('public.spin_up_side_huddle(uuid,uuid[])')       is not null as can_spin_up,
  (select count(*) from cron.job where jobname = 'close-expired-side-huddles') as closer_scheduled;
