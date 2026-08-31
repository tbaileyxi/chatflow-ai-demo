-- The same game held twice, merged rather than half-deleted.
--
-- 33 redundant rows across 32 clusters: same sport, same two teams, kickoffs
-- within six hours of each other. They arrived by several routes — two feeds
-- writing the same fixture under different ids, and a stale copy carrying a
-- wrong date that was later corrected onto the right one.
--
-- Earlier cleanups deleted only the rows nothing referenced, which was the right
-- call at the time: a chat message or a market pointing at a vanished game is
-- worse than a duplicate fixture. But that leaves the referenced ones forever.
-- This MOVES the references onto the survivor first, so nothing is orphaned and
-- nothing has to be spared.
--
-- WHICH ROW SURVIVES: the odds-feed row, because markets hang off
-- odds_game_id — an ESPN twin is a game nobody can bet on. Among equals, the
-- oldest, since anything already pointing at the pair most likely points there.
--
-- Six hours, not "same day": a 9:38pm ET baseball game is 01:38 UTC the next
-- morning, and the next afternoon's game in that series is 18 hours later. Both
-- are real. A day-wide window would merge two genuine games into one.
--
-- Run in the Supabase SQL editor. Safe to run twice.

do $$
declare
  grp     record;
  loser   uuid;
  fk      record;
  moved   integer;
  dropped integer;
  merged  integer := 0;
begin
  -- Cluster on teams + sport, then keep the first row of each six-hour window.
  for grp in
    with ranked as (
      select
        g.id,
        g.odds_game_id,
        g.start_time,
        first_value(g.id) over (
          partition by g.sport_key, g.home_team_id, g.away_team_id,
                       floor(extract(epoch from g.start_time) / 21600)
          order by (g.odds_game_id like 'espn-%')::int, g.created_at
        ) as keeper,
        count(*) over (
          partition by g.sport_key, g.home_team_id, g.away_team_id,
                       floor(extract(epoch from g.start_time) / 21600)
        ) as n
      from public.games g
      where g.home_team_id is not null
        and g.away_team_id is not null
    )
    select id, keeper from ranked where n > 1 and id <> keeper
  loop
    loser := grp.id;

    for fk in
      select c.conrelid::regclass as child_table, a.attname as child_column
      from pg_constraint c
      join lateral unnest(c.conkey) with ordinality k(attnum, ord) on true
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
      where c.contype = 'f' and c.confrelid = 'public.games'::regclass
    loop
      begin
        execute format('update %s set %I = $1 where %I = $2',
                       fk.child_table, fk.child_column, fk.child_column)
          using grp.keeper, loser;
        get diagnostics moved = row_count;
        if moved > 0 then
          raise notice 'moved % row(s) %.% -> keeper', moved, fk.child_table, fk.child_column;
        end if;
      exception when unique_violation then
        -- The keeper already has the equivalent child row, so the loser's copy
        -- is a duplicate too. Drop it rather than fail the whole merge.
        execute format('delete from %s where %I = $1', fk.child_table, fk.child_column)
          using loser;
        get diagnostics dropped = row_count;
        raise notice 'dropped % duplicate child row(s) in %.%',
          dropped, fk.child_table, fk.child_column;
      end;
    end loop;

    delete from public.games where id = loser;
    merged := merged + 1;
  end loop;

  raise notice 'merged % duplicate game row(s)', merged;
end;
$$;


-- Check. Expect 0.
select count(*) as duplicate_rows_left
from (
  select g.id,
         count(*) over (
           partition by g.sport_key, g.home_team_id, g.away_team_id,
                        floor(extract(epoch from g.start_time) / 21600)
         ) as n
  from public.games g
  where g.home_team_id is not null and g.away_team_id is not null
) s
where n > 1;
