-- Six sponsors per team, not one.
--
-- "Exclusive" and "$100" contradict each other: exclusivity is a premium idea,
-- and attaching it to a trivial price tells the buyer the exclusive is worth
-- nothing — which he reads as the audience being worth nothing. One of six at
-- the same price asks him to believe nothing about our size, and multiplies the
-- inventory from 195 slots to 1,170.

drop index if exists public.team_sponsors_active_unique;

-- Still capped. Six is a scoreboard; unlimited is worth nothing again, which is
-- the problem we just walked out of.
alter table public.team_sponsors
  add column if not exists slot smallint;

update public.team_sponsors t
set slot = s.rn
from (
  select id, row_number() over (partition by team_id order by created_at) as rn
  from public.team_sponsors
  where is_active = true
) s
where s.id = t.id and t.slot is null;

alter table public.team_sponsors
  drop constraint if exists team_sponsors_slot_range;
alter table public.team_sponsors
  add constraint team_sponsors_slot_range check (slot is null or slot between 1 and 6);

-- One sponsor per slot per team: six live at once, and no two can hold the same
-- position.
create unique index if not exists team_sponsors_slot_unique
  on public.team_sponsors (team_id, slot)
  where is_active = true;

select t.city || ' ' || t.name as team, s.brand_name, s.slot
from public.team_sponsors s
join public.teams t on t.id = s.team_id
where s.is_active = true
order by team, s.slot;
