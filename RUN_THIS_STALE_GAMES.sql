-- Games stuck "live" forever, showing a score from weeks ago.
--
-- A Mets room showed "Padres 1 — Mets 4, 9 · 0:00" with the live dot blinking,
-- against a team the Mets have not played in weeks, while the real upcoming
-- Astros game sat behind it.
--
-- useLiveGameContext takes the first game with status='in_progress' for the
-- team, newest first, WITH NO TIME BOUND — and only looks for a scheduled game
-- if it finds none. So one row that never got flipped to 'final' outranks every
-- real fixture from then on, permanently.
--
-- The app-side fix is a bound on that query, which needs an App Store release.
-- This is the data-side fix, which does not: close out anything that has been
-- "live" longer than any game lasts, and keep doing it on a schedule so a
-- missed sync heals itself instead of pinning a room to a dead game.
--
-- Nine hours: an NFL game runs ~3h10, baseball with extras can pass 5, and the
-- sync usually lags. Anything past nine hours is not a game, it is a stuck row.
--
-- Run in the Supabase SQL editor. Safe to run twice.

-- ── 1. what is actually stuck ────────────────────────────────────────────────
select
  count(*)                                                                as stuck_now,
  min(start_time)                                                         as oldest,
  count(*) filter (where start_time < now() - interval '7 days')          as older_than_a_week
from public.games
where status in ('in_progress', 'live', 'halftime')
  and start_time < now() - interval '9 hours';


-- ── 2. close them out ────────────────────────────────────────────────────────
-- Left as 'final' with whatever score they carried. That score may be wrong,
-- but a wrong final in the past is invisible, while a wrong LIVE game sits at
-- the top of a room blinking at everybody in it.
update public.games
set status = 'final',
    last_synced_at = now()   -- this table has last_synced_at, not updated_at
where status in ('in_progress', 'live', 'halftime')
  and start_time < now() - interval '9 hours';


-- ── 3. keep it closed ────────────────────────────────────────────────────────
create or replace function public.close_stale_live_games()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.games
  set status = 'final', last_synced_at = now()
  where status in ('in_progress', 'live', 'halftime')
    and start_time < now() - interval '9 hours';
  get diagnostics v_count = row_count;
  if v_count > 0 then
    raise warning '[close_stale_live_games] closed % stuck game(s)', v_count;
  end if;
  return v_count;
end;
$$;

revoke execute on function public.close_stale_live_games() from authenticated, anon;

-- Unschedule by COMMAND, not by name. Job names in this project have not
-- matched what they run, so matching on the name alone leaves a duplicate
-- running beside the new one.
do $$
declare
  j record;
begin
  for j in
    select jobid, jobname from cron.job
    where command like '%close_stale_live_games%'
  loop
    perform cron.unschedule(j.jobid);
    raise notice 'unscheduled existing job % (%)', j.jobid, j.jobname;
  end loop;
end;
$$;

select cron.schedule(
  'close-stale-live-games',
  '17 * * * *',                       -- hourly, off the hour so it does not
  $$select public.close_stale_live_games();$$  -- pile onto every other job
);


-- ── 4. check ─────────────────────────────────────────────────────────────────
select
  (select count(*) from public.games
    where status in ('in_progress','live','halftime')
      and start_time < now() - interval '9 hours')          as still_stuck,
  (select count(*) from public.games
    where status in ('in_progress','live','halftime'))      as live_right_now,
  (select count(*) from cron.job
    where command like '%close_stale_live_games%')          as cron_installed;
