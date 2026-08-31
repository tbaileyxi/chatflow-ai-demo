-- Memphis at UNLV, twice.
--
-- Both rows are now correct — that is the point. The odds row arrived labelled
-- "Clemson at Ole Miss", and the previous script repointed it to the real teams
-- rather than deleting it, because something referenced it. It is now a true
-- duplicate of the row we already held from ESPN.
--
-- Deleting a referenced row is the thing every cleanup so far has refused to do,
-- and rightly. So this MOVES the references first, then deletes.
--
-- The odds row survives: markets hang off odds_game_id, so it is the one other
-- tables are most likely to care about. The ESPN twin is the disposable half.
--
-- Written generically — it walks the foreign keys pointing at games rather than
-- naming child tables from memory, which is how an earlier draft ended up
-- guarding on a huddle_messages.game_id column that does not exist.
--
-- Run in the Supabase SQL editor. Safe to run twice.

do $$
declare
  winner uuid;   -- the odds row, kept
  loser  uuid;   -- the espn twin, merged away
  fk     record;
  moved  integer;
  dropped integer;
begin
  select g.id into winner
  from public.games g
  join public.teams aw on aw.id = g.away_team_id
  join public.teams hm on hm.id = g.home_team_id
  where aw.city = 'Memphis' and hm.city = 'UNLV'
    and g.away_score = 27 and g.home_score = 21
    and g.odds_game_id not like 'espn-%'
  limit 1;

  select g.id into loser
  from public.games g
  join public.teams aw on aw.id = g.away_team_id
  join public.teams hm on hm.id = g.home_team_id
  where aw.city = 'Memphis' and hm.city = 'UNLV'
    and g.away_score = 27 and g.home_score = 21
    and g.odds_game_id like 'espn-%'
  limit 1;

  if winner is null or loser is null then
    raise notice 'nothing to merge (winner=%, loser=%)', winner, loser;
    return;
  end if;

  raise notice 'merging % into %', loser, winner;

  for fk in
    select c.conrelid::regclass as child_table, a.attname as child_column
    from pg_constraint c
    join lateral unnest(c.conkey) with ordinality k(attnum, ord) on true
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
    where c.contype = 'f' and c.confrelid = 'public.games'::regclass
  loop
    -- Repoint what we can. A child table with a unique key on (game_id, ...)
    -- will reject the move where the winner already has the equivalent row —
    -- that is a duplicate too, so drop it rather than fail the merge.
    begin
      execute format('update %s set %I = $1 where %I = $2', fk.child_table, fk.child_column, fk.child_column)
        using winner, loser;
      get diagnostics moved = row_count;
      if moved > 0 then
        raise notice '  moved % row(s) in %.%', moved, fk.child_table, fk.child_column;
      end if;
    exception when unique_violation then
      execute format('delete from %s where %I = $1', fk.child_table, fk.child_column) using loser;
      get diagnostics dropped = row_count;
      raise notice '  %.% had equivalents on the winner; dropped % duplicate row(s)',
        fk.child_table, fk.child_column, dropped;
    end;
  end loop;

  delete from public.games where id = loser;
  raise notice 'merged.';
end;
$$;


-- Check: one Memphis/UNLV row, and the rest of that night unchanged.
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
