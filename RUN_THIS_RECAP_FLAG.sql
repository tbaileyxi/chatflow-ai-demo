-- Recaps by state, not by clock.
--
-- The recap searched for finals that started within N hours. Every value of N is
-- wrong, because you cannot predict when a game ENDS — rain delays, extra
-- innings, overtime. Three hours was shorter than a football game. Six hours
-- still loses a game that runs seven. The window was never the right idea.
--
-- A game either has had its recap or it has not. That is a fact about the game,
-- so it belongs on the game.
--
-- THE BACKFILL BELOW IS THE IMPORTANT PART. Without it, dropping the time bound
-- means every final ever played has a null flag, and the next poller run posts
-- a recap for all of them into every room at once. So everything that already
-- happened is marked as done, and only games finishing from now on can produce
-- one.
--
-- Run this BEFORE deploying the poller change. Safe to run twice.

-- ── 1. the flag ──────────────────────────────────────────────────────────────
alter table public.games
  add column if not exists recap_posted_at timestamptz;

comment on column public.games.recap_posted_at is
  'When the post-game recap went out. NULL means it has not, and the bot will '
  'post one once the game is final — however long after kickoff that happens.';

create index if not exists games_recap_pending_idx
  on public.games (status, recap_posted_at)
  where recap_posted_at is null;


-- ── 2. everything already played is already done ─────────────────────────────
-- Anything that kicked off more than three hours ago has either had its recap
-- or missed its chance. Either way it must not fire now.
update public.games
set recap_posted_at = now()
where recap_posted_at is null
  and start_time < now() - interval '3 hours';


-- ── 3. check ─────────────────────────────────────────────────────────────────
-- pending_recaps should be small — only games finishing around now. If it is in
-- the hundreds, stop and do not deploy the poller, or every room gets flooded.
select
  count(*) filter (where recap_posted_at is null and status = 'final')  as pending_recaps,
  count(*) filter (where recap_posted_at is null)                       as pending_any_status,
  count(*) filter (where recap_posted_at is not null)                   as marked_done
from public.games;
