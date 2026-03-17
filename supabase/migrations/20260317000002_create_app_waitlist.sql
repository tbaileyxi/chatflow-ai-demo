-- App download waitlist
create table if not exists public.app_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

-- Only service role can read; anyone can insert (public signups)
alter table public.app_waitlist enable row level security;

create policy "Anyone can join waitlist"
  on public.app_waitlist
  for insert
  to anon, authenticated
  with check (true);

create policy "Service role can read waitlist"
  on public.app_waitlist
  for select
  to service_role
  using (true);
