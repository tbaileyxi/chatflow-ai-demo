-- Games worth watching: rank them, and stop listing the same one twice.
--
-- THE FIRST VERSION OF THIS FAILED with "operator does not exist: text = uuid".
-- game_id is uuid on some tables and text on others, and I hand-wrote a list of
-- six tables assuming all of them matched games.id. Both halves of that were
-- wrong: the types differ, and there are thirteen tables carrying a game_id,
-- not six — arena_live_odds, arena_stakes, huddle_pings, notifications, picks
-- and seen_events were all missed, and every one of them would have been left
-- pointing at a row that no longer existed.
--
-- So it asks the catalogue instead of me. Every base table with a game_id
-- column gets repointed, cast to whatever that column actually is.

-- ── new columns ──────────────────────────────────────────────────────────────
alter table public.games add column if not exists broadcast text;      -- "ESPN", "FOX", "ESPN, ABC"
alter table public.games add column if not exists home_rank smallint;  -- AP poll, null when unranked
alter table public.games add column if not exists away_rank smallint;

create index if not exists games_broadcast_idx on public.games (broadcast)
  where broadcast is not null;


-- ── collapse the duplicates ──────────────────────────────────────────────────
do $$
declare
  r record;
  moved int := 0;
  killed int := 0;
begin
  drop table if exists _dupes;

  -- Keeper = the oldest row of each identical group. "Identical" means the same
  -- two teams at the same EXACT kickoff — a real doubleheader shares the teams
  -- and the date but never the minute, so it survives this.
  create temp table _dupes as
  with ranked as (
    select id,
           first_value(id) over (
             partition by home_team_id, away_team_id, start_time
             order by created_at, id
           ) as keeper
      from public.games
     where home_team_id is not null
       and away_team_id is not null
  )
  select id, keeper from ranked where id <> keeper;

  raise notice 'duplicate rows to remove: %', (select count(*) from _dupes);

  -- Repoint everything BEFORE deleting anything.
  for r in
    select c.table_name, c.data_type
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema
       and t.table_name = c.table_name
     where c.table_schema = 'public'
       and c.column_name = 'game_id'
       and t.table_type = 'BASE TABLE'
  loop
    execute format(
      'update public.%I t set game_id = d.keeper::%s from _dupes d
        where t.game_id::text = d.id::text',
      r.table_name,
      case when r.data_type = 'uuid' then 'uuid' else 'text' end
    );
    get diagnostics moved = row_count;
    if moved > 0 then
      raise notice 'repointed % row(s) in %', moved, r.table_name;
    end if;
  end loop;

  delete from public.games g using _dupes d where g.id = d.id;
  get diagnostics killed = row_count;
  raise notice 'deleted % duplicate game row(s)', killed;

  drop table _dupes;
end $$;


-- ── and stop it happening again ──────────────────────────────────────────────
create unique index if not exists games_one_row_per_fixture
  on public.games (home_team_id, away_team_id, start_time)
  where home_team_id is not null and away_team_id is not null;


select
  (select count(*) from public.games) as games_total,
  (select count(*) from public.games where broadcast is not null) as with_tv;
