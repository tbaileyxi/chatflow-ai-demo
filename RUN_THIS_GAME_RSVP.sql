-- Who's actually watching this one.
--
-- A room is at its deadest in the hours BEFORE a game, which is exactly when
-- it should be busiest: that is when people decide where they're watching and
-- who with. Presence can't answer it — presence is "in the room right now",
-- and the question is "will you be here at 8".
--
-- One row per person per game. Deliberately tiny: this is a yes, not an event
-- with a location and a guest list. The interesting fact is the count and the
-- faces, and anything more is a calendar app.
--
-- Run in the Supabase SQL editor. Safe to run twice.

create table if not exists public.huddle_game_rsvps (
  id uuid primary key default gen_random_uuid(),
  huddle_id uuid not null references public.huddles(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Saying you're in twice is still just being in.
create unique index if not exists huddle_game_rsvps_once
  on public.huddle_game_rsvps(huddle_id, game_id, user_id);

create index if not exists idx_huddle_game_rsvps_lookup
  on public.huddle_game_rsvps(huddle_id, game_id);

alter table public.huddle_game_rsvps enable row level security;

-- Visible to the room, because the whole point is seeing who else is in.
drop policy if exists "Members can see who is in" on public.huddle_game_rsvps;
create policy "Members can see who is in"
on public.huddle_game_rsvps
for select
using (
  exists (
    select 1 from public.huddle_members hm
    where hm.huddle_id = huddle_game_rsvps.huddle_id
      and hm.user_id = auth.uid()
  )
);

-- You can only speak for yourself, and only in a room you're in.
drop policy if exists "Members can say they are in" on public.huddle_game_rsvps;
create policy "Members can say they are in"
on public.huddle_game_rsvps
for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.huddle_members hm
    where hm.huddle_id = huddle_game_rsvps.huddle_id
      and hm.user_id = auth.uid()
  )
);

drop policy if exists "You can take it back" on public.huddle_game_rsvps;
create policy "You can take it back"
on public.huddle_game_rsvps
for delete
using (user_id = auth.uid());

select
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_name = 'huddle_game_rsvps') as table_created,
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'huddle_game_rsvps') as policies;
