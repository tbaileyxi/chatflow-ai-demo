-- One row per fixture, even when the feed renames it.
--
-- The earlier dedupe keyed on the EXACT kickoff and the unique index does the
-- same, so it only ever caught pairs that agreed to the second. The feed does
-- not: it hands us the same game under a new odds_game_id with a start time
-- minutes adrift, and sync-games-live upserts on odds_game_id, so a new id is
-- a new row. 121 fixtures are doubled right now.
--
-- WHY TWO HOURS IS SAFE, measured rather than assumed. Gaps between same-teams
-- same-day pairs in this table:
--     under 5 min   99
--     5-30 min      13
--     30min-2h       7
--     2h-4h          0     <- nothing lives here
--     over 4h       20     <- real doubleheaders
-- There is a clean empty band between "duplicate" and "second game of a
-- doubleheader", and two hours sits in it.

-- ── collapse what is already there ───────────────────────────────────────────
do $$
declare r record; moved int; killed int := 0;
begin
  drop table if exists _fixdupes;

  -- Keeper = the earliest row of each cluster of same-teams games starting
  -- within two hours of it.
  create temp table _fixdupes as
  with pairs as (
    select a.id as loser, b.id as keeper
      from public.games a
      join public.games b
        on a.home_team_id = b.home_team_id
       and a.away_team_id = b.away_team_id
       and a.id <> b.id
       and abs(extract(epoch from (a.start_time - b.start_time))) < 7200
     where a.home_team_id is not null
       and a.away_team_id is not null
       -- Keep the older row; drop the newer one.
       and (b.start_time, b.created_at, b.id) < (a.start_time, a.created_at, a.id)
  )
  -- A cluster of three would otherwise name two keepers; collapse to the
  -- single earliest.
  select loser, min(keeper::text)::uuid as keeper from pairs group by loser;

  raise notice 'duplicate fixtures to remove: %', (select count(*) from _fixdupes);

  for r in
    select c.table_name, c.data_type
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema and t.table_name = c.table_name
     where c.table_schema = 'public'
       and c.column_name = 'game_id'
       and t.table_type = 'BASE TABLE'
  loop
    execute format(
      'update public.%I t set game_id = d.keeper::%s from _fixdupes d
        where t.game_id::text = d.loser::text',
      r.table_name,
      case when r.data_type = 'uuid' then 'uuid' else 'text' end
    );
    get diagnostics moved = row_count;
    if moved > 0 then raise notice 'repointed % row(s) in %', moved, r.table_name; end if;
  end loop;

  delete from public.games g using _fixdupes d where g.id = d.loser;
  get diagnostics killed = row_count;
  raise notice 'deleted % duplicate fixture row(s)', killed;

  drop table _fixdupes;
end $$;


-- ── and stop it coming back ──────────────────────────────────────────────────
-- A unique index cannot express "within two hours", so this is a trigger.
-- It does not reject the insert — it FOLDS it into the row that already
-- exists, so the score and clock still land and the caller sees no error.
create or replace function public.fold_duplicate_fixture()
returns trigger language plpgsql as $$
declare v_existing uuid;
begin
  if new.home_team_id is null or new.away_team_id is null then
    return new;
  end if;

  select id into v_existing
    from public.games
   where home_team_id = new.home_team_id
     and away_team_id = new.away_team_id
     and abs(extract(epoch from (start_time - new.start_time))) < 7200
   order by created_at
   limit 1;

  if v_existing is null then
    return new;
  end if;

  -- Same fixture under a different provider id. Update what is there and
  -- throw the insert away.
  update public.games
     set status      = coalesce(new.status, status),
         home_score  = coalesce(new.home_score, home_score),
         away_score  = coalesce(new.away_score, away_score),
         clock       = coalesce(new.clock, clock),
         period      = coalesce(new.period, period),
         start_time  = new.start_time,
         last_synced_at = now()
   where id = v_existing;

  return null;
end $$;

drop trigger if exists games_fold_duplicate on public.games;
create trigger games_fold_duplicate
  before insert on public.games
  for each row execute function public.fold_duplicate_fixture();


select
  (select count(*) from public.games) as games_total,
  (select count(*) from pg_trigger
    where tgrelid = 'public.games'::regclass
      and tgname = 'games_fold_duplicate') as guard_installed;  -- expect 1
