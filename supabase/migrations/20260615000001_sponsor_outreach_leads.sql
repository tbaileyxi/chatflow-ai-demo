-- Sponsor outreach: Apollo-enriched leads + Brevo sequence state.
-- Replaces the CSV files (master_leads.csv / emailed_global.csv / bounced_emails.csv)
-- from the reference AISEARCHAudit pipeline with a single Postgres table.

create table if not exists public.sponsor_leads (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- prospecting context
  vertical          text not null,
  region            text,

  -- company
  company           text not null,
  website           text,
  domain            text,
  phone             text,
  rating            numeric,
  review_count      int,
  linkedin_url      text,
  instagram_handle  text,

  -- contact
  contact_name      text,
  contact_title     text,
  contact_email     text,
  email_confidence  text,                 -- high | medium | low
  priority          text,                 -- TIER1 | TIER2

  -- apollo provenance
  apollo_person_id  text,
  apollo_org_id     text,

  -- sequence state (mirrors brevo_send.py columns)
  emailed           boolean not null default false,
  emailed_at        timestamptz,
  sequence_step     int not null default 0,

  -- suppression
  bounced           boolean not null default false,
  unsubscribed      boolean not null default false,
  last_error        text
);

-- Dedup on contact email (replaces master_leads.csv email key).
-- Emails are stored already lowercased by the enrich function, and rows without
-- an email use NULL (NULLs are distinct, so many no-email rows coexist). A plain
-- column unique index is what ON CONFLICT (contact_email) infers in the upsert.
create unique index if not exists sponsor_leads_email_uniq
  on public.sponsor_leads (contact_email);

-- Domain lookup for step-1 "already contacted this company" dedup
-- (replaces emailed_global.csv domain dedup).
create index if not exists sponsor_leads_domain_idx
  on public.sponsor_leads (lower(domain));

create index if not exists sponsor_leads_sequence_idx
  on public.sponsor_leads (sequence_step, emailed);

-- keep updated_at fresh
create or replace function public.sponsor_leads_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists sponsor_leads_set_updated_at on public.sponsor_leads;
create trigger sponsor_leads_set_updated_at
  before update on public.sponsor_leads
  for each row execute function public.sponsor_leads_touch_updated_at();

-- ============================================================
-- RLS: admin-only. Edge Functions use the service-role key (bypasses RLS);
-- the dashboard reads as an authenticated admin.
-- ============================================================
alter table public.sponsor_leads enable row level security;

drop policy if exists "Admins manage sponsor leads" on public.sponsor_leads;
create policy "Admins manage sponsor leads"
  on public.sponsor_leads
  for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role));
