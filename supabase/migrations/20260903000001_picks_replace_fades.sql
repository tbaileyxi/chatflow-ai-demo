-- Picks replace fades: you pick a side, you do not claim one.
--
-- The fade model needed an opponent. A prop had a poster and an accepter, and
-- taking a side somebody already held returned "Couldn't take that side —
-- someone already claimed this prop". In a four-person room that means the
-- second person to open a card is told no, which is the opposite of what a
-- room full of people arguing about a game wants. The whole head-to-head
-- apparatus — poster_id, accepter_id, winner_id, paid_marked_by,
-- paid_confirmed_by — existed to referee a duel nobody asked for.
--
-- So: everybody picks. Over and under both hold as many people as want them,
-- the interesting object is the SPLIT, and settlement is a fact about the
-- market rather than a contest between two users.
--
-- fades is left in place and empty (it holds zero rows) rather than dropped,
-- so nothing referencing it breaks mid-deploy. It stops being written to.

create table if not exists public.picks (
  id uuid primary key default gen_random_uuid(),
  huddle_id uuid not null references public.huddles(id) on delete cascade,
  market_id uuid not null references public.kalshi_markets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  side text not null check (side in ('yes', 'no')),

  -- Every pick is 100. There is no stake picker, no top-up and no premium
  -- upgrade: chips are a season score, not a currency, so a column that can
  -- only ever hold 100 today still keeps the door open for a future where a
  -- room sets its own number.
  stake integer not null default 100 check (stake > 0),

  -- Copied at pick time. A line gets re-hung and a question gets rewritten by
  -- the next sync, and a pick that silently changes its own wording afterwards
  -- is a pick nobody can argue about later.
  question text not null,
  side_label text,
  game_id uuid,
  event_start_time timestamptz,

  status text not null default 'open' check (status in ('open', 'won', 'lost', 'void')),
  settled_at timestamptz,
  created_at timestamptz not null default now(),

  -- One pick per person per prop. A second row would be changing your mind,
  -- not competing with yourself — the app updates the side in place.
  unique (market_id, user_id)
);

create index if not exists picks_huddle_open_idx
  on public.picks (huddle_id, status, created_at desc);
create index if not exists picks_market_idx on public.picks (market_id);
create index if not exists picks_user_idx on public.picks (user_id, status);

alter table public.picks enable row level security;

-- Reading is room-scoped: the split is the feature, so everybody in the room
-- sees who is on which side. Nobody outside it does.
drop policy if exists "Members read picks in their rooms" on public.picks;
create policy "Members read picks in their rooms" on public.picks
  for select using (public.is_huddle_member(huddle_id, auth.uid()));

drop policy if exists "Members pick in their own rooms" on public.picks;
create policy "Members pick in their own rooms" on public.picks
  for insert with check (
    user_id = auth.uid() and public.is_huddle_member(huddle_id, auth.uid())
  );

-- Change your mind, but only before it settles and only your own.
drop policy if exists "Own open picks are editable" on public.picks;
create policy "Own open picks are editable" on public.picks
  for update using (user_id = auth.uid() and status = 'open')
  with check (user_id = auth.uid() and status = 'open');

drop policy if exists "Own open picks are removable" on public.picks;
create policy "Own open picks are removable" on public.picks
  for delete using (user_id = auth.uid() and status = 'open');


-- Settle every open pick on a market that has resolved.
--
-- kalshi_markets.resolution holds the winning side. A pick matching it wins,
-- the other side loses, and a market that resolved to neither voids both —
-- a postponed game must not cost anybody a hundred chips.
create or replace function public.settle_picks()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  touched integer;
begin
  with resolved as (
    select id, lower(coalesce(resolution, '')) as res
    from public.kalshi_markets
    where is_resolved = true
  )
  update public.picks p
  set status = case
        when r.res not in ('yes', 'no') then 'void'
        when r.res = p.side then 'won'
        else 'lost'
      end,
      settled_at = now()
  from resolved r
  where p.market_id = r.id
    and p.status = 'open';

  get diagnostics touched = row_count;
  return touched;
end;
$$;


-- The ledger and the leaderboard are the same question asked two ways: who is
-- on what side, and who has been right. Net chips can go negative — that is the
-- point of chips being a score rather than a balance you can run out of.
create or replace function public.pick_leaderboard(_huddle_id uuid)
returns table (
  user_id uuid,
  net integer,
  won integer,
  lost integer,
  open integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.user_id,
    coalesce(sum(case p.status
      when 'won' then p.stake
      when 'lost' then -p.stake
      else 0 end), 0)::integer                                as net,
    count(*) filter (where p.status = 'won')::integer         as won,
    count(*) filter (where p.status = 'lost')::integer        as lost,
    count(*) filter (where p.status = 'open')::integer        as open
  from public.picks p
  where p.huddle_id = _huddle_id
  group by p.user_id
  order by net desc;
$$;

grant execute on function public.pick_leaderboard(uuid) to authenticated;
