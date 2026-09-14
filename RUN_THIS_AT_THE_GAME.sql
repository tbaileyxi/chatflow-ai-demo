-- At the game.
--
-- WHAT IS STORED: a venue id and an expiry. That is the whole row.
-- No latitude, no longitude, no history, not even for yourself. The phone
-- works out which stadium it is near using the venue list it already has
-- downloaded, and sends back only the answer. Coordinates never leave the
-- device and there is nowhere here to put them if they did.
--
-- WHO CAN SEE IT: people you are connected to, and nobody else. That is
-- enforced by the select policy below, not by the app remembering to filter.

create table if not exists public.venue_presence (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  venue_id    uuid not null references public.venues(id) on delete cascade,
  until       timestamptz not null,
  updated_at  timestamptz not null default now()
);

create index if not exists venue_presence_until_idx on public.venue_presence (until);

alter table public.venue_presence enable row level security;

-- ONE select policy, and it is the security boundary. Permissive policies OR
-- together, so a second one added later widens this rather than narrowing it.
drop policy if exists "see your own and your friends" on public.venue_presence;
create policy "see your own and your friends"
on public.venue_presence for select
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.friend_connections f
     where f.status = 'accepted'
       and ((f.requester_id = auth.uid() and f.addressee_id = venue_presence.user_id)
         or (f.addressee_id = auth.uid() and f.requester_id = venue_presence.user_id))
  )
);

drop policy if exists "write only your own" on public.venue_presence;
create policy "write only your own"
on public.venue_presence for all
using (user_id = auth.uid()) with check (user_id = auth.uid());


-- The switch in Profile. On by default, but it is not the real gate — iOS
-- location permission is, and that is never asked for until someone turns
-- this on themselves.
alter table public.profiles
  add column if not exists share_at_venue boolean not null default true;


-- Check in. Takes a venue, never a position.
create or replace function public.check_in_at_venue(p_venue_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'not signed in'; end if;

  -- The switch wins over anything the client thinks it is doing.
  if not coalesce((select share_at_venue from public.profiles where user_id = v_me), true) then
    delete from public.venue_presence where user_id = v_me;
    return;
  end if;

  if not exists (select 1 from public.venues where id = p_venue_id) then
    raise exception 'no such venue';
  end if;

  -- THREE HOURS is a decay, not a fact. We only know where you are while the
  -- app is open — there is no background location here, deliberately — so this
  -- is how long we keep believing the last thing we were told. Long enough to
  -- survive a phone in a pocket through a half; short enough to clear the same
  -- evening on its own, with no job to run.
  insert into public.venue_presence (user_id, venue_id, until, updated_at)
  values (v_me, p_venue_id, now() + interval '3 hours', now())
  on conflict (user_id) do update
    set venue_id = excluded.venue_id, until = excluded.until, updated_at = now();
end $$;

-- Leave. Called when you walk out of range, and when you turn the switch off.
create or replace function public.check_out_of_venue()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  delete from public.venue_presence where user_id = auth.uid();
end $$;

grant execute on function public.check_in_at_venue(uuid) to authenticated;
grant execute on function public.check_out_of_venue() to authenticated;


select
  (select count(*) from public.venues) as venues,          -- expect 106
  (select count(*) from public.venue_presence) as checked_in;  -- expect 0
