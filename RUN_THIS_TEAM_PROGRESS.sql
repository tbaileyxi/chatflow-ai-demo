-- Which searches have actually been done, per team.
--
-- "No local businesses" and "I never looked for local businesses" render
-- identically today — both are an empty list — so there is no way to tell a
-- finished team from an untouched one. That is the whole question the sidebar
-- is meant to answer.
--
-- Also lets a team be added before it has anybody in it, which is otherwise
-- impossible: the team list is derived from the leads, so a team with no leads
-- does not exist.

create table if not exists public.team_progress (
  team        text not null,
  kind        text not null check (kind in ('chapters', 'partner', 'business')),
  searched_at timestamptz not null default now(),
  found       integer not null default 0,
  primary key (team, kind)
);

-- A team can be listed with no searches done at all — that is the point of
-- adding one.
create table if not exists public.outreach_teams (
  team     text primary key,
  added_at timestamptz not null default now()
);

alter table public.team_progress  enable row level security;
alter table public.outreach_teams enable row level security;

-- Admin-only, same as the rest of the outreach tables.
drop policy if exists "Admins manage team progress" on public.team_progress;
create policy "Admins manage team progress" on public.team_progress
  for all using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins manage outreach teams" on public.outreach_teams;
create policy "Admins manage outreach teams" on public.outreach_teams
  for all using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

select 'ready' as status;
