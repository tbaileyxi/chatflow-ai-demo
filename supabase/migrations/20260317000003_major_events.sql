-- ============================================================
-- MAJOR EVENTS
-- ============================================================

-- Core events table
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text,                          -- e.g. "The Masters"
  sport text not null,                      -- golf | nfl | nba | mlb | nhl | other
  league text,                              -- PGA | NFL | etc.
  description text,
  image_url text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'upcoming'   -- upcoming | live | ended
    check (status in ('upcoming','live','ended')),

  -- Kalshi prediction markets
  kalshi_market_ticker text,               -- e.g. "MASTERS-2026-WINNER"
  kalshi_market_url text,

  -- Content pipeline config
  content_pulse_interval_minutes int not null default 20,  -- during live
  content_daily_pull_hour int not null default 6,          -- UTC hour for pre-event daily pull

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-discovered content sources per event
create table if not exists public.event_content_sources (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  platform text not null check (platform in ('twitter','reddit')),
  source_type text not null check (source_type in ('account','hashtag','subreddit')),
  source_value text not null,               -- @handle, #hashtag, r/subredditname
  auto_discovered boolean not null default true,
  confidence float,                         -- 0-1 score from discovery
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (event_id, platform, source_value)
);

-- Which huddles have opted in to an event
create table if not exists public.huddle_event_subscriptions (
  id uuid primary key default gen_random_uuid(),
  huddle_id uuid not null,                  -- references huddles.id
  event_id uuid not null references public.events(id) on delete cascade,
  subscribed_by uuid not null,              -- user_id of admin who opted in
  subscribed_at timestamptz not null default now(),
  unique (huddle_id, event_id)
);

-- Cached content pulled from X / Reddit for an event
create table if not exists public.event_content (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  source_id uuid references public.event_content_sources(id) on delete set null,
  platform text not null check (platform in ('twitter','reddit')),
  external_id text not null,               -- tweet id or reddit post id
  author text,
  content text,
  url text,
  media_urls text[],
  engagement_score int default 0,          -- likes + retweets or upvotes
  pulled_at timestamptz not null default now(),
  unique (platform, external_id)
);

-- ============================================================
-- RLS
-- ============================================================

alter table public.events enable row level security;
alter table public.event_content_sources enable row level security;
alter table public.huddle_event_subscriptions enable row level security;
alter table public.event_content enable row level security;

-- Events: anyone can read; only service_role can write
create policy "Events are publicly readable"
  on public.events for select to anon, authenticated using (true);

create policy "Service role manages events"
  on public.events for all to service_role using (true) with check (true);

-- Content sources: authenticated can read; service_role manages
create policy "Content sources are readable"
  on public.event_content_sources for select to authenticated using (true);

create policy "Service role manages content sources"
  on public.event_content_sources for all to service_role using (true) with check (true);

-- Huddle subscriptions: authenticated users can read and insert for their huddles
create policy "Huddle event subscriptions are readable"
  on public.huddle_event_subscriptions for select to authenticated using (true);

create policy "Huddle admins can subscribe"
  on public.huddle_event_subscriptions for insert to authenticated with check (
    subscribed_by = auth.uid()
  );

create policy "Huddle admins can unsubscribe"
  on public.huddle_event_subscriptions for delete to authenticated using (
    subscribed_by = auth.uid()
  );

-- Event content: authenticated can read; service_role writes
create policy "Event content is readable"
  on public.event_content for select to authenticated using (true);

create policy "Service role manages event content"
  on public.event_content for all to service_role using (true) with check (true);

-- ============================================================
-- Updated_at trigger
-- ============================================================

create or replace function public.update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger events_updated_at
  before update on public.events
  for each row execute function public.update_updated_at();

-- ============================================================
-- Indexes
-- ============================================================

create index if not exists events_status_starts_at on public.events(status, starts_at);
create index if not exists event_content_sources_event_id on public.event_content_sources(event_id, active);
create index if not exists event_content_event_id_pulled on public.event_content(event_id, pulled_at desc);
create index if not exists huddle_event_subs_event_id on public.huddle_event_subscriptions(event_id);
create index if not exists huddle_event_subs_huddle_id on public.huddle_event_subscriptions(huddle_id);
