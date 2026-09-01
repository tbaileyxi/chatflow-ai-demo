-- A Georgia fixture that does not exist, filled with the wrong opponent.
--
-- A scheduled row sat at 2026-09-03 with Georgia and a NULL opponent. ESPN has
-- no Georgia game that day — their opener is Tennessee State on September 5,
-- which we already hold correctly. The row is phantom.
--
-- Worse, the repair pass filled it: matching on the bare nickname "Bulldogs"
-- found Fresno State Bulldogs at USC and wrote USC in as the opponent, so the
-- public Georgia page advertised a game against the Trojans. The matcher now
-- requires a full city-and-nickname match, so it cannot happen again — this
-- clears what it left behind.
--
-- Run in the Supabase SQL editor. Safe to run twice.

-- Only if nothing references it. A message or market pointing at a deleted game
-- is worse than a phantom fixture nobody sees.
create temp table phantom on commit drop as
select g.id
from public.games g
join public.teams aw on aw.id = g.away_team_id
where g.sport_key = 'americanfootball_ncaaf'
  and g.start_time::date = date '2026-09-03'
  and aw.city = 'Georgia';

do $$
declare fk record;
begin
  for fk in
    select c.conrelid::regclass as child_table, a.attname as child_column
    from pg_constraint c
    join lateral unnest(c.conkey) with ordinality k(attnum, ord) on true
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
    where c.contype = 'f' and c.confrelid = 'public.games'::regclass
  loop
    execute format('delete from phantom d where exists (select 1 from %s t where t.%I = d.id)',
                   fk.child_table, fk.child_column);
  end loop;
end;
$$;

delete from public.games g using phantom p where g.id = p.id;

-- Check: Georgia's next fixture should be Tennessee State on September 5.
select g.start_time, aw.city || ' ' || aw.name as away, hm.city || ' ' || hm.name as home
from public.games g
join public.teams hm on hm.id = g.home_team_id
join public.teams aw on aw.id = g.away_team_id
where (hm.city = 'Georgia' or aw.city = 'Georgia')
  and g.sport_key = 'americanfootball_ncaaf'
  and g.status = 'scheduled'
order by g.start_time
limit 3;
