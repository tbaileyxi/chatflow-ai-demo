-- Official Huddle admin controls and public profile fields.

alter table public.huddles
  add column if not exists website_url text,
  add column if not exists official_status text not null default 'inactive'
    check (official_status in ('inactive', 'active', 'past_due', 'cancelled'));

create table if not exists public.huddle_admins (
  id uuid primary key default gen_random_uuid(),
  huddle_id uuid not null references public.huddles(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  created_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  unique (huddle_id, user_id)
);

create table if not exists public.huddle_bans (
  id uuid primary key default gen_random_uuid(),
  huddle_id uuid not null references public.huddles(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  banned_by uuid references public.profiles(user_id) on delete set null,
  reason text,
  created_at timestamptz not null default now(),
  unique (huddle_id, user_id)
);

alter table public.huddle_admins enable row level security;
alter table public.huddle_bans enable row level security;

create policy "Members can view huddle admins"
on public.huddle_admins
for select
using (
  exists (
    select 1 from public.huddle_members hm
    where hm.huddle_id = huddle_admins.huddle_id
      and hm.user_id = auth.uid()
  )
  or exists (
    select 1 from public.huddles h
    where h.id = huddle_admins.huddle_id
      and h.is_verified = true
      and h.is_private = false
  )
);

create policy "Owners can manage huddle admins"
on public.huddle_admins
for all
using (
  exists (
    select 1 from public.huddles h
    where h.id = huddle_admins.huddle_id
      and h.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.huddles h
    where h.id = huddle_admins.huddle_id
      and h.owner_id = auth.uid()
  )
);

create policy "Owners and admins can view bans"
on public.huddle_bans
for select
using (
  exists (
    select 1 from public.huddles h
    where h.id = huddle_bans.huddle_id
      and h.owner_id = auth.uid()
  )
  or exists (
    select 1 from public.huddle_admins ha
    where ha.huddle_id = huddle_bans.huddle_id
      and ha.user_id = auth.uid()
  )
);

create policy "Owners and admins can manage bans"
on public.huddle_bans
for all
using (
  exists (
    select 1 from public.huddles h
    where h.id = huddle_bans.huddle_id
      and h.owner_id = auth.uid()
  )
  or exists (
    select 1 from public.huddle_admins ha
    where ha.huddle_id = huddle_bans.huddle_id
      and ha.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.huddles h
    where h.id = huddle_bans.huddle_id
      and h.owner_id = auth.uid()
  )
  or exists (
    select 1 from public.huddle_admins ha
    where ha.huddle_id = huddle_bans.huddle_id
      and ha.user_id = auth.uid()
  )
);
