-- The same game, twice.
--
-- Two feeds write to this table. The odds feed uses its own 32-char hash for
-- odds_game_id; sync-live-scores uses `espn-<sport>-<id>`. Neither could see the
-- other's row, so a game arrived once from each — 146 twins out of 1000 rows,
-- kickoff times a minute or two apart.
--
-- sync-live-scores no longer creates them (it now checks teams + kickoff day,
-- not just its own id). This clears out the ones already there.
--
-- WHICH ONE SURVIVES: the odds row. Markets hang off odds_game_id, so an ESPN
-- twin is a game nobody can bet on. And nothing is deleted if anything at all
-- points at it — a message, a market, a fade. A duplicate fixture in a list is a
-- blemish; a chat message whose game vanished is a broken room.
--
-- Run in the Supabase SQL editor. Safe to run twice.

-- ── 1. what would go ─────────────────────────────────────────────────────────
create temp table dupe_candidates on commit drop as
with grouped as (
  select
    id,
    odds_game_id,
    row_number() over (
      partition by sport_key, home_team_id, away_team_id, (start_time at time zone 'utc')::date
      -- Keep the odds row. Among equals, keep the oldest.
      order by (odds_game_id like 'espn-%')::int, created_at
    ) as rn
  from public.games
  where home_team_id is not null and away_team_id is not null
)
select id from grouped
where rn > 1
  and odds_game_id like 'espn-%';   -- never delete an odds row

select count(*) as twins_found from dupe_candidates;


-- ── 2. spare anything that is referenced ─────────────────────────────────────
-- Walks every foreign key pointing at games rather than naming tables by hand,
-- so a table added later is covered without editing this.
do $$
declare
  fk record;
  removed integer;
begin
  for fk in
    select
      c.conrelid::regclass as child_table,
      a.attname            as child_column
    from pg_constraint c
    join lateral unnest(c.conkey) with ordinality k(attnum, ord) on true
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
    where c.contype = 'f'
      and c.confrelid = 'public.games'::regclass
  loop
    execute format(
      'delete from dupe_candidates d where exists (select 1 from %s t where t.%I = d.id)',
      fk.child_table, fk.child_column
    );
    get diagnostics removed = row_count;
    if removed > 0 then
      raise notice 'spared % twin(s) referenced by %.%', removed, fk.child_table, fk.child_column;
    end if;
  end loop;
end;
$$;

select count(*) as safe_to_delete from dupe_candidates;


-- ── 3. delete ────────────────────────────────────────────────────────────────
delete from public.games g using dupe_candidates d where g.id = d.id;


-- ── 4. check ─────────────────────────────────────────────────────────────────
-- remaining_twins should be only the ones something still points at.
select count(*) as remaining_twins from (
  select 1
  from public.games
  where home_team_id is not null and away_team_id is not null
  group by sport_key, home_team_id, away_team_id, (start_time at time zone 'utc')::date
  having count(*) > 1
) s;
