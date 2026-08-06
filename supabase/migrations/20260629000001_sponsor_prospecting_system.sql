-- Expand sponsor outreach from a cold-email list into a school/market sponsor CRM.

alter table public.sponsor_leads
  add column if not exists market text,
  add column if not exists school text,
  add column if not exists distance_miles numeric,
  add column if not exists sponsor_signal text,
  add column if not exists sponsor_score int,
  add column if not exists best_package text,
  add column if not exists best_angle text,
  add column if not exists status text not null default 'New',
  add column if not exists follow_up_date date,
  add column if not exists last_touch date,
  add column if not exists notes text;

create index if not exists sponsor_leads_status_idx
  on public.sponsor_leads (status);

create index if not exists sponsor_leads_follow_up_idx
  on public.sponsor_leads (follow_up_date)
  where follow_up_date is not null;

create index if not exists sponsor_leads_score_idx
  on public.sponsor_leads (sponsor_score desc nulls last);
