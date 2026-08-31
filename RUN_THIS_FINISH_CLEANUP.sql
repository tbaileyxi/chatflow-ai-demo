-- Finish the cleanup: one wrong team, five mangled names, one phantom game.
--
-- The ROOT CAUSE is fixed in code and deployed. sync-games-live matched teams by
-- bare nickname, by substring, and finally by LAST WORD, across all leagues at
-- once — so "New Mexico State Aggies" found Texas A&M, "Hawai'i Rainbow
-- Warriors" found Golden State, "Sacramento State" found the Kings. Worse, it
-- upserts on odds_game_id and rewrote those team ids on EVERY run, which is why
-- the Texas A&M row was repaired by hand and then quietly reverted. It now
-- matches on school and league only, and never overwrites a team it did not
-- resolve itself.
--
-- That stops new damage and stops repairs being undone. This fixes what is left.
--
-- Run in the Supabase SQL editor. Safe to run twice.

-- ── 1. the game Texas A&M did not play ───────────────────────────────────────
-- New Mexico State lost 34-17 to Florida State on 2026-08-29. Texas A&M did not
-- play that day at all (verified against ESPN). This repair was applied once
-- before and reverted within the minute; it holds now.
update public.games g
set away_team_id = (select id from public.teams
                    where city = 'New Mexico State' and league = 'NCAA' limit 1)
where g.odds_game_id = '9bbc04340f2b3f77756a22bc44e1a4a4'
  and g.away_team_id = (select id from public.teams
                        where city = 'Texas A&M' and league = 'NCAA' limit 1);


-- ── 2. names that read as "Hawai'i Hawai'i" ──────────────────────────────────
-- Opponent placeholders were built from ESPN's shortDisplayName, an abbreviated
-- SCHOOL rather than a nickname, so the city prepended to it stuttered. New rows
-- read the nickname properly; these five predate that. Nicknames below come from
-- ESPN's own team list, not from memory.
update public.teams set name = 'Bison' where id = '43c69d74-1061-4ca0-83b8-310bb6fbc68a' and status = 'inactive';  -- North Dakota State: was "N Dakota St"
update public.teams set name = 'Rainbow Warriors' where id = '47a9fd87-5429-4788-bc6c-32963877db76' and status = 'inactive';  -- Hawai'i: was "Hawai'i"
update public.teams set name = 'Aggies' where id = 'c3992f59-6a5b-4584-83ec-c0350e2f2a04' and status = 'inactive';  -- New Mexico State: was "New Mexico St"
update public.teams set name = 'Gamecocks' where id = '55c51fe1-b1f0-4802-8980-49fc2b1b23fb' and status = 'inactive';  -- Jacksonville State: was "Jax State"
update public.teams set name = 'Rebels' where id = 'f8d0b15e-aabe-4410-a395-e20569816fec' and status = 'inactive';  -- UNLV: was "UNLV"


-- ── 3. the duplicate USC row ─────────────────────────────────────────────────
-- Both feeds hold San José State at USC, 26-42, same kickoff. Keeping the odds
-- row: markets hang off its id, so the ESPN twin is the disposable one. Skipped
-- if anything references it.
create temp table usc_twin on commit drop as
select g.id
from public.games g
where g.odds_game_id like 'espn-%'
  and g.sport_key = 'americanfootball_ncaaf'
  and g.start_time::date = date '2026-08-29'
  and g.home_team_id = (select id from public.teams where city = 'USC' and league = 'NCAA' limit 1)
  and exists (
    select 1 from public.games o
    where o.id <> g.id
      and o.home_team_id = g.home_team_id
      and o.away_team_id = g.away_team_id
      and o.start_time::date = g.start_time::date
      and o.odds_game_id not like 'espn-%');

-- Spare it if anything points at it. Walks the real foreign keys rather than
-- naming a column by hand — an earlier draft guarded on huddle_messages.game_id,
-- which does not exist, and would have failed the whole script.
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
      'delete from usc_twin d where exists (select 1 from %s t where t.%I = d.id)',
      fk.child_table, fk.child_column);
  end loop;
end;
$$;

delete from public.games g using usc_twin d where g.id = d.id;


-- ── 4. what is left ──────────────────────────────────────────────────────────
-- Expect: New Mexico State Bison-style names read properly, no Texas A&M row on
-- Aug 29, one USC row. "Sacramento Kings at Boston College" should still be
-- here — BC's first 2026 game is September 5 at Cincinnati, so that row is a
-- game that never happened, and it is left alone until we know what references
-- it (section 3 of RUN_THIS_NICKNAME_MIXUPS.sql reports that).
select
  g.start_time::time                  as kickoff,
  aw.city || ' ' || aw.name           as away,
  hm.city || ' ' || hm.name           as home,
  g.away_score || '-' || g.home_score as score
from public.games g
join public.teams hm on hm.id = g.home_team_id
join public.teams aw on aw.id = g.away_team_id
where g.sport_key = 'americanfootball_ncaaf'
  and g.start_time::date = date '2026-08-29'
order by kickoff;
