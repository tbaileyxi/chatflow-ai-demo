-- "Lakers @ Aggies", in a college football game.
--
-- A Texas A&M room showed a Sep 6 fixture against the Lakers. Others carry the
-- Sharks, the Rams, the Marlins, Hurricanes, Kings — pro teams pinned to
-- college football games because the odds feed matched on nickname alone, and
-- nicknames collide across sports.
--
-- The matcher is league-scoped now: 40 of these 49 rows were written on
-- 2026-08-25 and none since. So this is cleanup of what that bug left behind,
-- not a workaround for something still happening.
--
-- Nothing is deleted if anything references it — a chat message or a market
-- pointing at a vanished game is worse than a wrong fixture nobody bets on.
--
-- Run in the Supabase SQL editor. Safe to run twice.

create temp table wrong_league on commit drop as
select g.id
from public.games g
join public.teams h on h.id = g.home_team_id
join public.teams a on a.id = g.away_team_id
where case g.sport_key
        when 'americanfootball_nfl'   then 'NFL'
        when 'americanfootball_ncaaf' then 'NCAA'
        when 'basketball_nba'         then 'NBA'
        when 'basketball_ncaab'       then 'NCAA'
        when 'baseball_mlb'           then 'MLB'
        when 'icehockey_nhl'          then 'NHL'
      end is distinct from null
  and (
    h.league is distinct from case g.sport_key
        when 'americanfootball_nfl'   then 'NFL'
        when 'americanfootball_ncaaf' then 'NCAA'
        when 'basketball_nba'         then 'NBA'
        when 'basketball_ncaab'       then 'NCAA'
        when 'baseball_mlb'           then 'MLB'
        when 'icehockey_nhl'          then 'NHL' end
    or
    a.league is distinct from case g.sport_key
        when 'americanfootball_nfl'   then 'NFL'
        when 'americanfootball_ncaaf' then 'NCAA'
        when 'basketball_nba'         then 'NBA'
        when 'basketball_ncaab'       then 'NCAA'
        when 'baseball_mlb'           then 'MLB'
        when 'icehockey_nhl'          then 'NHL' end
  );

select count(*) as wrong_league_games from wrong_league;


-- Spare anything referenced. Walks every foreign key pointing at games rather
-- than naming tables by hand, so a table added later is covered too.
do $$
declare fk record; removed integer;
begin
  for fk in
    select c.conrelid::regclass as child_table, a.attname as child_column
    from pg_constraint c
    join lateral unnest(c.conkey) with ordinality k(attnum, ord) on true
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
    where c.contype = 'f' and c.confrelid = 'public.games'::regclass
  loop
    execute format(
      'delete from wrong_league d where exists (select 1 from %s t where t.%I = d.id)',
      fk.child_table, fk.child_column);
    get diagnostics removed = row_count;
    if removed > 0 then
      raise notice 'spared % referenced by %.%', removed, fk.child_table, fk.child_column;
    end if;
  end loop;
end;
$$;

select count(*) as safe_to_delete from wrong_league;

delete from public.games g using wrong_league d where g.id = d.id;


-- Check. Should be 0, or only rows something still points at.
select count(*) as remaining
from public.games g
join public.teams h on h.id = g.home_team_id
join public.teams a on a.id = g.away_team_id
where h.league <> a.league;
