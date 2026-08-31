-- Who posts about each team, and how to reach them.
--
-- Same shape as chapter_leads on purpose: same statuses, same sequence_step,
-- same dashboard habits. Nothing new to learn.
--
-- Run in the Supabase SQL editor. Safe to run twice.

create table if not exists public.creator_leads (
  id             uuid primary key default gen_random_uuid(),
  handle         text not null,
  display_name   text,
  team_id        uuid references public.teams(id) on delete set null,
  org            text,                    -- "Colorado Buffaloes", for filtering
  followers      integer default 0,
  posts_seen     integer default 0,
  likes_seen     integer default 0,
  -- Engagement EARNED, not audience size. A 1.7k account averaging 45 likes is
  -- a better room owner than a 90k newspaper averaging 3, and sorting by
  -- followers buries exactly the people worth talking to.
  avg_likes      integer default 0,
  best_post      text,
  bio            text,
  email          text,                    -- pulled out of the bio when present
  website        text,
  status         text not null default 'new',
  sequence_step  integer not null default 0,
  emailed        boolean not null default false,
  huddle_id      uuid references public.huddles(id) on delete set null,
  last_touch     date,
  notes          text,
  first_seen     timestamptz not null default now(),
  last_seen      timestamptz not null default now(),

  constraint creator_leads_status_check
    check (status in ('new','queued','sent','replied','onboarded','dead')),
  constraint creator_leads_handle_unique unique (handle)
);

create index if not exists creator_leads_org_idx    on public.creator_leads (org);
create index if not exists creator_leads_rank_idx   on public.creator_leads (avg_likes desc);
create index if not exists creator_leads_status_idx on public.creator_leads (status);

comment on table public.creator_leads is
  'X accounts that actually post about a team, found by searching the fanbase '
  'rather than by who we happen to follow. Ranked by engagement earned.';

-- Only the dashboard reads this, signed in as an admin. The edge function writes
-- with the service role and bypasses RLS.
alter table public.creator_leads enable row level security;

drop policy if exists creator_leads_admin_read on public.creator_leads;
create policy creator_leads_admin_read on public.creator_leads
  for select to authenticated
  using (public.get_current_user_role() = 'admin');

drop policy if exists creator_leads_admin_write on public.creator_leads;
create policy creator_leads_admin_write on public.creator_leads
  for update to authenticated
  using (public.get_current_user_role() = 'admin');

select
  (select count(*) from information_schema.tables
    where table_name = 'creator_leads') as table_created,
  (select count(*) from public.creator_leads) as rows_now;
