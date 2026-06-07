-- Bot Engine v2: tables for live game events, news ingestion, and emission tracking.
-- Iron rule: every fact the bot speaks must be reproducible from these tables.

-- ============================================================
-- 1. team_feeds: one or more RSS feeds per team for the news poller.
-- ============================================================
create table if not exists public.team_feeds (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  feed_url text not null,
  source_label text,                   -- e.g. "google_news", "espn"
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (team_id, feed_url)
);

create index if not exists idx_team_feeds_active on public.team_feeds(team_id) where is_active = true;

-- ============================================================
-- 2. seen_news: RSS entry dedupe. We never re-emit the same article id.
-- ============================================================
create table if not exists public.seen_news (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  entry_id text not null,              -- stable id from feed (guid/id/hash)
  title text not null,
  link text not null,
  source text,
  published_at timestamptz,
  category text,                       -- HIGH/MED/LOW/DROP from the cheap classifier
  llm_score int,                       -- 0-100 from judge, null if bypassed
  cluster_size int default 1,          -- how many sources reported same story
  emitted boolean not null default false,
  emitted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (team_id, entry_id)
);

create index if not exists idx_seen_news_team_emitted on public.seen_news(team_id, emitted_at desc);

-- ============================================================
-- 3. seen_events: live-game play dedupe. A play is emitted at most once.
-- ============================================================
create table if not exists public.seen_events (
  id uuid primary key default gen_random_uuid(),
  game_id text not null,               -- provider's game id (string for portability)
  event_id text not null,              -- provider's event/play id
  team_id uuid references public.teams(id) on delete set null,
  excitement_score int,                -- 0-100
  emitted boolean not null default false,
  emitted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (game_id, event_id)
);

create index if not exists idx_seen_events_game on public.seen_events(game_id, created_at desc);

-- ============================================================
-- 4. bot_emit_log: every message the bot publishes, with the fact payload that produced it.
-- Used for: daily cap enforcement, audit, debugging hallucinations.
-- ============================================================
create table if not exists public.bot_emit_log (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id) on delete set null,
  huddle_id uuid references public.huddles(id) on delete set null,
  mode text not null check (mode in ('in_game', 'news')),
  source_ref text,                     -- seen_news.id or seen_events.id
  facts jsonb not null,                -- the structured payload sent to the model
  message_text text not null,
  excitement_score int,
  pushed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_bot_emit_team_day on public.bot_emit_log(team_id, created_at desc);
create index if not exists idx_bot_emit_mode on public.bot_emit_log(mode, created_at desc);

-- ============================================================
-- 5. RLS: bot tables are service-role only.
-- ============================================================
alter table public.team_feeds enable row level security;
alter table public.seen_news enable row level security;
alter table public.seen_events enable row level security;
alter table public.bot_emit_log enable row level security;
-- (service role bypasses RLS; no client-facing policies needed)

-- ============================================================
-- 6. Seed default Google News + ESPN feeds for every team that doesn't have one.
-- Programmatic, never hand-listed. Sport hint inferred from league.
-- ============================================================
insert into public.team_feeds (team_id, feed_url, source_label)
select
  t.id,
  'https://news.google.com/rss/search?q=' ||
    replace(replace('"' || coalesce(t.city || ' ' || t.name, t.name) || '" ' ||
      case
        when t.league in ('NFL','NCAA') then 'football'
        when t.league in ('NBA','NCAAB') then 'basketball'
        when t.league = 'MLB' then 'baseball'
        when t.league = 'NHL' then 'hockey'
        else ''
      end, ' ', '+'), '"', '%22') ||
    '&hl=en-US&gl=US&ceid=US:en',
  'google_news'
from public.teams t
where not exists (
  select 1 from public.team_feeds f where f.team_id = t.id and f.source_label = 'google_news'
)
on conflict (team_id, feed_url) do nothing;

-- ============================================================
-- 7. Retire old bot cron jobs and schedule the new pollers.
-- Hardcoded URL/anon-key pattern matches existing migrations
-- (see 20260607000002_bot_scoreboard_cadence_cleanup.sql).
-- ============================================================
do $$
declare
  job_name text;
begin
  for job_name in
    select jobname from cron.job
    where jobname like 'pulse-scheduler%'
       or jobname like 'live-game-bot%'
       or jobname like 'coach-proactive%'
       or jobname like 'pulse-drop%'
       or jobname in ('bot-live-poller', 'bot-news-poller')
  loop
    perform cron.unschedule(job_name);
  end loop;
exception when others then
  -- safe to ignore if cron extension or jobs don't exist
  null;
end $$;

-- Retire the @coach mention trigger that called the deleted team-chatbot function.
-- We're not killing @mentions forever, but the v2 launch has no @coach UI affordance.
-- Replace the function body with a no-op so existing triggers don't 404.
create or replace function public.notify_coach_mention()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $func$
begin
  return new;
end;
$func$;

-- Live poller every minute. Function decides whether to actually poll
-- (only fires real HTTP fetches when a tracked team has an active game).
select cron.schedule(
  'bot-live-poller',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/bot-live-poller',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlanV3eWV5cGlnZ3ZseWZsaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjU4MDgsImV4cCI6MjA2OTU0MTgwOH0.XHylH6wJuJjSZxU904oCZ33N0swsoRm6Tr2VjwI1Lz0"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- News poller every 30 minutes.
select cron.schedule(
  'bot-news-poller',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := 'https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/bot-news-poller',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlanV3eWV5cGlnZ3ZseWZsaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjU4MDgsImV4cCI6MjA2OTU0MTgwOH0.XHylH6wJuJjSZxU904oCZ33N0swsoRm6Tr2VjwI1Lz0"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);
