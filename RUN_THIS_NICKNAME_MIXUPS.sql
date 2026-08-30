-- Three more games wearing the wrong team's name.
--
-- These are the rows the earlier cleanup deliberately spared: something
-- references them, so deleting was the wrong move. But they are all wrong, and
-- all wrong the same way — the odds feed matched a NICKNAME or a CITY with no
-- regard for which league it belonged to:
--
--   Hawai'i Rainbow WARRIORS   -> Golden State Warriors   (Stanford's opponent)
--   SAN JOSE State Spartans    -> San Jose Sharks         (USC's opponent)
--   SACRAMENTO State           -> Sacramento Kings        (Boston College)
--
-- The first two are verified against ESPN for 2026-08-29: Hawai'i 27 at
-- Stanford 37, and San José State 26 at USC 42. Both scores already match what
-- we stored, so only the team is wrong — repoint, do not delete.
--
-- The third is different and worse: Boston College's first game of 2026 is
-- SEPTEMBER 5 at Cincinnati, per ESPN's own schedule for the team. There was no
-- BC game on August 29. That row is not a mislabelled game, it is a game that
-- never happened, so it is reported rather than repaired — see section 3.
--
-- Run in the Supabase SQL editor. Safe to run twice.

-- ── 1. give the games back to the right teams ────────────────────────────────
-- Opponent rows are created as 'inactive' by sync-live-scores, which keeps them
-- out of every picker and discovery list while still letting a scoreboard print
-- a name. If one is missing here, the sync will make it on its next pass and
-- this section can be re-run.

-- Hawai'i, not the Warriors.
update public.games g
set away_team_id = t.id
from public.teams t
where t.league = 'NCAA' and t.city ilike 'Hawai%'
  and g.sport_key = 'americanfootball_ncaaf'
  and g.start_time::date = date '2026-08-29'
  and g.home_team_id = (select id from public.teams where city = 'Stanford' and league = 'NCAA' limit 1)
  and g.away_team_id in (select id from public.teams where league = 'NBA');

-- San José State, not the Sharks.
update public.games g
set away_team_id = t.id
from public.teams t
where t.league = 'NCAA' and (t.city ilike 'San Jos%')
  and g.sport_key = 'americanfootball_ncaaf'
  and g.start_time::date = date '2026-08-29'
  and g.home_team_id = (select id from public.teams where city = 'USC' and league = 'NCAA' limit 1)
  and g.away_team_id in (select id from public.teams where league = 'NHL');


-- ── 2. check the repairs ─────────────────────────────────────────────────────
select
  g.start_time::date                  as played,
  aw.city || ' ' || aw.name           as away,
  hm.city || ' ' || hm.name           as home,
  g.away_score || '-' || g.home_score as score
from public.games g
join public.teams hm on hm.id = g.home_team_id
join public.teams aw on aw.id = g.away_team_id
where g.start_time::date = date '2026-08-29'
  and g.sport_key = 'americanfootball_ncaaf'
order by home;


-- ── 3. the phantom Boston College game ───────────────────────────────────────
-- Nothing is deleted here. This only reports WHAT references the row, because
-- that is the one thing we could not see when the earlier cleanup spared it.
-- Once we know whether it is a message, a market or a fade, we can decide
-- whether the reference goes with it.
do $$
declare
  fk record;
  gid uuid;
  n integer;
begin
  select g.id into gid
  from public.games g
  join public.teams hm on hm.id = g.home_team_id
  where hm.city = 'Boston College'
    and g.start_time::date = date '2026-08-29'
  limit 1;

  if gid is null then
    raise notice 'no phantom Boston College row found — already handled';
    return;
  end if;

  raise notice 'phantom game id: %', gid;
  for fk in
    select c.conrelid::regclass as child_table, a.attname as child_column
    from pg_constraint c
    join lateral unnest(c.conkey) with ordinality k(attnum, ord) on true
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
    where c.contype = 'f' and c.confrelid = 'public.games'::regclass
  loop
    execute format('select count(*) from %s t where t.%I = $1', fk.child_table, fk.child_column)
      into n using gid;
    if n > 0 then
      raise notice 'referenced by %.% (% row(s))', fk.child_table, fk.child_column, n;
    end if;
  end loop;
end;
$$;
