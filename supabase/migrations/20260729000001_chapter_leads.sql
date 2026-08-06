-- Chapter outreach leads: fan-club and alumni chapters scraped by chapter-db/.
--
-- Deliberately mirrors public.sponsor_leads so outreach-send can drive both with
-- the same step/bounce/suppression logic. Scraped attributes are refreshed by
-- re-running the scraper; sequence state is owned here and must survive that.

create table if not exists public.chapter_leads (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- provenance
  source            text not null,               -- browns_worldwide, psu_chapters, …
  source_url        text,

  -- the organisation the chapter belongs to
  org               text not null,               -- Cleveland Browns, Penn State, …
  org_type          text not null default 'nfl', -- nfl | college

  -- the chapter itself
  chapter_name      text not null,
  city              text,
  state             text,
  zip               text,
  country           text default 'US',
  venue             text,                        -- bar/venue NAME only
  address           text,
  member_count      int,
  year_established  int,

  -- who to talk to
  leader_name       text,
  leader_role       text,                        -- President, Organizer, Contact
  first_name        text,                        -- split off leader_name for merge fields
  email             text,
  phone             text,
  facebook          text,
  instagram         text,
  twitter           text,
  website           text,
  contact_channel   text not null default 'none', -- email | facebook | phone | none

  -- ranking
  score             int not null default 0,

  -- ── sequence state: owned here, never overwritten by a re-scrape ──────────
  status            text not null default 'new',  -- new|queued|sent|replied|onboarded|dead
  emailed           boolean not null default false,
  emailed_at        timestamptz,
  sequence_step     int not null default 0,
  bounced           boolean not null default false,
  unsubscribed      boolean not null default false,
  last_error        text,
  follow_up_date    date,
  last_touch        date,
  notes             text,

  -- one row per real-world chapter, even when two directories list it
  dedupe_key        text not null
);

-- Upsert target for the push command. Chapters reachable only by Facebook have
-- no email, so the key falls back to org+city+chapter (see export.py:dedupe_key).
create unique index if not exists chapter_leads_dedupe_uniq
  on public.chapter_leads (dedupe_key);

create index if not exists chapter_leads_status_idx  on public.chapter_leads (status);
create index if not exists chapter_leads_score_idx   on public.chapter_leads (score desc);
create index if not exists chapter_leads_channel_idx on public.chapter_leads (contact_channel);
create index if not exists chapter_leads_org_idx     on public.chapter_leads (org);
create index if not exists chapter_leads_sequence_idx
  on public.chapter_leads (sequence_step, emailed);
create index if not exists chapter_leads_followup_idx
  on public.chapter_leads (follow_up_date) where follow_up_date is not null;

-- keep updated_at fresh (same trigger shape as sponsor_leads)
create or replace function public.chapter_leads_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists chapter_leads_set_updated_at on public.chapter_leads;
create trigger chapter_leads_set_updated_at
  before update on public.chapter_leads
  for each row execute function public.chapter_leads_touch_updated_at();

-- ============================================================
-- RLS: admin-only. Edge Functions use the service-role key (bypasses RLS);
-- the dashboard reads as an authenticated admin.
-- ============================================================
alter table public.chapter_leads enable row level security;

drop policy if exists chapter_leads_admin_all on public.chapter_leads;
create policy chapter_leads_admin_all
  on public.chapter_leads
  for all
  using (public.get_current_user_role() = 'admin')
  with check (public.get_current_user_role() = 'admin');
