-- One word for "this game is happening".
--
-- A live UNC game sat in the database with status 'live' while the room header
-- queries for 'in_progress', so the room showed next week's fixture instead.
-- sync-live-scores writes 'in_progress'; something else writes 'live'. Rather
-- than chase every writer, the column enforces one vocabulary.
--
-- Also folds 'completed' into 'final' for the same reason: sync-live-scores'
-- live_events path uses 'completed' while everything reading games looks for
-- 'final'.
--
-- Run in the Supabase SQL editor. Safe to run twice.

-- ── 1. fix what is there now ─────────────────────────────────────────────────
update public.games set status = 'in_progress' where status in ('live', 'inprogress');
update public.games set status = 'final'       where status in ('completed', 'complete');


-- ── 2. and everything written from here on ───────────────────────────────────
create or replace function public.normalize_game_status()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('live', 'inprogress') then
    new.status := 'in_progress';
  elsif new.status in ('completed', 'complete') then
    new.status := 'final';
  end if;
  return new;
end;
$$;

drop trigger if exists games_normalize_status on public.games;
create trigger games_normalize_status
  before insert or update on public.games
  for each row execute function public.normalize_game_status();


-- ── 3. check ─────────────────────────────────────────────────────────────────
-- Expect only scheduled / in_progress / final. Anything else is a vocabulary
-- nobody reading this table knows about.
select status, count(*) as games
from public.games
group by status
order by games desc;
