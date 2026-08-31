-- Two more games with the wrong teams on them, both now identified.
--
-- These are the last two an ESPN audit of our 41 football finals could not
-- corroborate. Both come from the same last-word matcher in sync-games-live,
-- already fixed in code — a nickname was enough to claim a game:
--
--   "Sacramento State"       -> Sacramento Kings      (NBA)
--   "Eastern Michigan EAGLES"-> Boston College Eagles
--   "Memphis TIGERS"         -> Clemson Tigers
--   "UNLV REBELS"            -> Ole Miss Rebels
--
-- Verified against ESPN for those dates:
--   Sacramento State Hornets 17 at Eastern Michigan Eagles 28  (2026-08-29)
--   Memphis Tigers 27 at UNLV Rebels 21                        (2026-08-30)
--
-- Both scores already match what we stored, which is what makes the
-- identification certain: only the teams were wrong.
--
-- Run in the Supabase SQL editor. Safe to run twice.

-- ── 1. the two schools we have never seen ────────────────────────────────────
-- Created 'inactive', like every other opponent placeholder: invisible in team
-- pickers and discovery, present only so a scoreboard can name both sides.
insert into public.teams (city, name, league, status)
select 'Sacramento State', 'Hornets', 'NCAA', 'inactive'
where not exists (select 1 from public.teams
                  where city = 'Sacramento State' and league = 'NCAA');

insert into public.teams (city, name, league, status)
select 'Eastern Michigan', 'Eagles', 'NCAA', 'inactive'
where not exists (select 1 from public.teams
                  where city = 'Eastern Michigan' and league = 'NCAA');


-- ── 2. give Sacramento State its game back ───────────────────────────────────
-- Boston College's first 2026 game is September 5 at Cincinnati, so the BC room
-- has been showing a 28-17 win over a basketball team for a game it did not
-- play. This is a real game, so it is repointed rather than deleted.
update public.games
set away_team_id = (select id from public.teams
                    where city = 'Sacramento State' and league = 'NCAA' limit 1),
    home_team_id = (select id from public.teams
                    where city = 'Eastern Michigan' and league = 'NCAA' limit 1)
where (sport_key = 'americanfootball_ncaaf'
       and start_time = timestamptz '2026-08-29 22:32:00+00'
       and away_team_id = (select id from public.teams where city = 'Sacramento' and league = 'NBA' limit 1));


-- ── 3. Clemson did not beat Ole Miss ─────────────────────────────────────────
-- That row is Memphis 27 at UNLV 21, which we ALSO hold correctly from ESPN.
-- So it is a duplicate as well as mislabelled: drop it if nothing references it,
-- and otherwise repoint it so at least it stops lying to a Clemson room.
create temp table clemson_ghost on commit drop as
select g.id
from public.games g
join public.teams aw on aw.id = g.away_team_id
join public.teams hm on hm.id = g.home_team_id
where g.sport_key = 'americanfootball_ncaaf'
  and g.start_time::date in (date '2026-08-29', date '2026-08-30')
  and aw.city = 'Clemson' and hm.city = 'Ole Miss'
  and g.away_score = 27 and g.home_score = 21;

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
    execute format(
      'delete from clemson_ghost d where exists (select 1 from %s t where t.%I = d.id)',
      fk.child_table, fk.child_column);
  end loop;
end;
$$;

delete from public.games g using clemson_ghost d where g.id = d.id;

-- Anything spared above is referenced, so repoint it to the real teams.
update public.games g
set away_team_id = (select id from public.teams where city = 'Memphis' and league = 'NCAA' limit 1),
    home_team_id = (select id from public.teams where city = 'UNLV'    and league = 'NCAA' limit 1)
from public.teams aw, public.teams hm
where aw.id = g.away_team_id and hm.id = g.home_team_id
  and aw.city = 'Clemson' and hm.city = 'Ole Miss'
  and g.away_score = 27 and g.home_score = 21
  and g.start_time::date in (date '2026-08-29', date '2026-08-30');


-- ── 4. check ─────────────────────────────────────────────────────────────────
-- Expect Sacramento State at Eastern Michigan, and no Clemson/Ole Miss row.
select
  g.start_time,
  aw.city || ' ' || aw.name           as away,
  hm.city || ' ' || hm.name           as home,
  g.away_score || '-' || g.home_score as score
from public.games g
join public.teams hm on hm.id = g.home_team_id
join public.teams aw on aw.id = g.away_team_id
where g.sport_key = 'americanfootball_ncaaf'
  and g.start_time >= timestamptz '2026-08-29 22:00:00+00'
  and g.start_time <  timestamptz '2026-08-30 06:00:00+00'
order by g.start_time;
