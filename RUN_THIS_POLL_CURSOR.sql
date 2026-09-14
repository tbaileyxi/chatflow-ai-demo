-- Remember what we last saw, so we stop asking ESPN the same question.
--
-- The poller calls the per-game summary endpoint for EVERY live game on EVERY
-- poll, and it polls every one to two minutes. On an NFL Sunday with fourteen
-- games that is roughly ten thousand unkeyed requests a day from a datacenter
-- IP — and we already know how ESPN feels about that, because site.api.espn.com
-- returns 403 to Supabase and the bot only works through a User-Agent
-- workaround on one host.
--
-- The scoreboard already tells us the score, for one call per LEAGUE. So: ask
-- the cheap endpoint what changed, and only open a game when it did.
--
-- Its own table, not game_states — that one is written by ncaa-live-updates,
-- and a second writer setting last_score to the current score would make this
-- skip a game that HAD moved. A missed touchdown is a much worse failure than
-- one extra request.

create table if not exists public.poller_game_cursor (
  game_provider_id text primary key,
  last_score       text not null,
  last_status      text,
  seen_at          timestamptz not null default now()
);

create index if not exists poller_game_cursor_seen_idx
  on public.poller_game_cursor (seen_at);

alter table public.poller_game_cursor enable row level security;
-- Service role only. Nothing in the app reads this and no policy grants
-- anybody else a row.

select count(*) as cursor_rows from public.poller_game_cursor;
