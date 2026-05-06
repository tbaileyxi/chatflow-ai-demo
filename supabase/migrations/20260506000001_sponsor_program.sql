-- Founding sponsor program: track claimed sponsorships + inquiries.
-- Teams come from the existing public.teams table (with logos).

create table if not exists public.sponsor_teams (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  status text not null default 'available' check (status in ('available','pending','confirmed')),
  claimed_by text,
  brand_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id)
);

create table if not exists public.sponsor_inquiries (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id) on delete set null,
  team_name text not null,
  league text not null,
  brand_name text not null,
  contact_name text not null,
  email text not null,
  phone text,
  other_teams text,
  message text,
  type text not null check (type in ('inquiry','purchase')),
  bundle_size integer not null default 1,
  monthly_total integer not null default 250,
  free_months integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.sponsor_teams enable row level security;
alter table public.sponsor_inquiries enable row level security;

drop policy if exists "sponsor_teams public read" on public.sponsor_teams;
create policy "sponsor_teams public read" on public.sponsor_teams
  for select using (status = 'confirmed');

drop policy if exists "sponsor_inquiries public insert" on public.sponsor_inquiries;
create policy "sponsor_inquiries public insert" on public.sponsor_inquiries
  for insert with check (true);

create index if not exists sponsor_teams_team_idx on public.sponsor_teams(team_id);
create index if not exists sponsor_inquiries_team_idx on public.sponsor_inquiries(team_id);
