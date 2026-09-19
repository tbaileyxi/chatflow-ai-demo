-- VERIFIED CREATORS, BY INVITE LINK.
--
-- A creator gets a single-use link: https://sidehuddlesports.com/invite/<token>.
-- Whoever claims it (after signup or login) gets the handle bound to the
-- invite, the verified badge, and a team room they own. That room is what the
-- X auto-pull (creator-mirror) fills. No X OAuth in v1: the bearer of the
-- link is trusted with the handle it was made for. No payments anywhere.
--
-- The badge and the handle live on profiles. creator_accounts, added a day
-- earlier as the auto-pull's allow-list, is folded in here and dropped, so
-- there is one place that says who a creator is.

-- ── 1. profiles: the handle and the badge ─────────────────────────────────
alter table public.profiles add column if not exists x_handle text;
alter table public.profiles add column if not exists verified_creator boolean not null default false;
create unique index if not exists profiles_x_handle_unique
  on public.profiles (lower(x_handle)) where x_handle is not null;

-- Users can edit their own profile row, so these two columns need a guard:
-- only the functions below (which run as the table owner) or the service role
-- may change them. A client that tries gets an error, not a quiet badge.
create or replace function public.guard_creator_columns()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.x_handle := null;
      new.verified_creator := false;
    elsif new.x_handle is distinct from old.x_handle
       or new.verified_creator is distinct from old.verified_creator then
      raise exception 'x_handle and verified_creator are set by Side Huddle';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists guard_creator_columns on public.profiles;
create trigger guard_creator_columns
  before insert or update on public.profiles
  for each row execute function public.guard_creator_columns();

-- Fold creator_accounts in, then drop it.
do $$
begin
  if to_regclass('public.creator_accounts') is not null then
    update public.profiles p
       set x_handle = ca.x_handle, verified_creator = true
      from public.creator_accounts ca
     where ca.user_id = p.user_id;
    drop table public.creator_accounts;
  end if;
end $$;

-- ── 2. creator_invites ────────────────────────────────────────────────────
create table if not exists public.creator_invites (
  id                 uuid primary key default gen_random_uuid(),
  token              text not null unique default replace(gen_random_uuid()::text, '-', ''),
  x_handle           text not null,
  team_id            uuid not null references public.teams(id),
  status             text not null default 'pending'
                       check (status in ('pending', 'claimed', 'revoked')),
  claimed_by_user_id uuid references auth.users(id) on delete set null,
  claimed_at         timestamptz,
  created_at         timestamptz not null default now()
);
-- One live token per creator.
create unique index if not exists creator_invites_one_pending
  on public.creator_invites (lower(x_handle)) where status = 'pending';

alter table public.creator_invites enable row level security;
drop policy if exists "admins read creator invites" on public.creator_invites;
create policy "admins read creator invites" on public.creator_invites
  for select using (public.get_current_user_role() = 'admin');
-- No write policies: every change goes through the functions below.

-- ── 3. the grant itself (internal) ────────────────────────────────────────
-- Binds the handle to the user, sets the badge, and makes sure they own a
-- room for the team carrying that handle. Returns the room. One account per
-- handle: anyone else holding it loses it.
create or replace function public._grant_creator(p_user uuid, p_handle text, p_team_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_handle text := regexp_replace(trim(p_handle), '^@', '');
  v_room   uuid;
begin
  if v_handle = '' then raise exception 'handle required'; end if;
  if p_team_id is null then raise exception 'team required'; end if;

  update public.profiles
     set x_handle = null, verified_creator = false
   where lower(x_handle) = lower(v_handle) and user_id <> p_user;

  update public.profiles
     set x_handle = v_handle, verified_creator = true
   where user_id = p_user;
  if not found then raise exception 'no profile for that user'; end if;

  select id into v_room from public.huddles
   where owner_id = p_user and lower(x_handle) = lower(v_handle)
     and coalesce(is_game_room, false) = false and coalesce(is_dm, false) = false
   order by created_at limit 1;

  if v_room is null then
    insert into public.huddles
      (name, owner_id, team_id, is_private, is_official_team_huddle, is_verified, member_count, x_handle)
    values
      ('@' || v_handle, p_user, p_team_id, false, false, false, 1, v_handle)
    returning id into v_room;
    insert into public.huddle_members (huddle_id, user_id)
    values (v_room, p_user) on conflict do nothing;
  end if;

  return v_room;
end $$;
revoke all on function public._grant_creator(uuid, text, uuid) from public, anon, authenticated;

-- ── 4. the creator claims their link ──────────────────────────────────────
create or replace function public.claim_creator_invite(p_token text)
returns table (huddle_id uuid, x_handle text)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.creator_invites;
  v_room uuid;
begin
  if v_uid is null then raise exception 'sign in first'; end if;

  select * into v_inv from public.creator_invites
   where token = trim(p_token) for update;
  if not found then raise exception 'invite_not_found'; end if;
  if v_inv.status = 'claimed' then raise exception 'invite_already_claimed'; end if;
  if v_inv.status = 'revoked' then raise exception 'invite_revoked'; end if;

  v_room := public._grant_creator(v_uid, v_inv.x_handle, v_inv.team_id);

  update public.creator_invites
     set status = 'claimed', claimed_by_user_id = v_uid, claimed_at = now()
   where id = v_inv.id;

  return query select v_room, v_inv.x_handle;
end $$;
grant execute on function public.claim_creator_invite(text) to authenticated;

-- What the web page shows for a link before anyone signs in.
create or replace function public.creator_invite_preview(p_token text)
returns table (x_handle text, team_name text, status text)
language sql security definer set search_path = public stable as $$
  select i.x_handle, trim(coalesce(t.city, '') || ' ' || coalesce(t.name, '')), i.status
    from public.creator_invites i
    left join public.teams t on t.id = i.team_id
   where i.token = trim(p_token);
$$;
grant execute on function public.creator_invite_preview(text) to anon, authenticated;

-- ── 5. admin: link, revoke, manual grant ──────────────────────────────────
-- The link for a handle. A pending one is returned as-is (one token per
-- creator); a claimed one is reported, not replaced; after a revoke, a new one.
create or replace function public.admin_creator_invite(p_handle text, p_team_id uuid)
returns table (token text, status text, claimed_by_user_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_handle text := regexp_replace(trim(p_handle), '^@', '');
begin
  if public.get_current_user_role() is distinct from 'admin' then
    raise exception 'admin only';
  end if;

  return query
    select i.token, i.status, i.claimed_by_user_id from public.creator_invites i
     where lower(i.x_handle) = lower(v_handle) and i.status in ('pending', 'claimed')
     order by i.created_at desc limit 1;
  if found then return; end if;

  if p_team_id is null then raise exception 'pick a team first'; end if;
  return query
    insert into public.creator_invites (x_handle, team_id)
    values (v_handle, p_team_id)
    returning creator_invites.token, creator_invites.status, creator_invites.claimed_by_user_id;
end $$;
grant execute on function public.admin_creator_invite(text, uuid) to authenticated;

-- Revoke: the badge comes off and every live or claimed invite for the handle
-- is marked revoked. The handle stays on the profile; without the badge the
-- auto-pull no longer treats their room as a creator room.
create or replace function public.admin_revoke_creator(p_handle text)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_handle text := regexp_replace(trim(p_handle), '^@', '');
  v_n integer;
begin
  if public.get_current_user_role() is distinct from 'admin' then
    raise exception 'admin only';
  end if;
  update public.profiles set verified_creator = false
   where lower(x_handle) = lower(v_handle);
  get diagnostics v_n = row_count;
  update public.creator_invites set status = 'revoked'
   where lower(x_handle) = lower(v_handle) and status in ('pending', 'claimed');
  return v_n;
end $$;
grant execute on function public.admin_revoke_creator(text) to authenticated;

-- Manual grant, for a creator who signed up without tapping the link.
-- p_user is their username, email, or user id.
create or replace function public.admin_grant_creator(p_user text, p_handle text, p_team_id uuid)
returns uuid language plpgsql security definer set search_path = public, auth as $$
declare
  v_uid uuid;
  v_q   text := trim(p_user);
begin
  if public.get_current_user_role() is distinct from 'admin' then
    raise exception 'admin only';
  end if;

  if v_q ~* '^[0-9a-f-]{36}$' then
    v_uid := v_q::uuid;
  elsif position('@' in v_q) > 1 then
    select id into v_uid from auth.users where lower(email) = lower(v_q) limit 1;
  else
    select user_id into v_uid from public.profiles
     where lower(username) = lower(regexp_replace(v_q, '^@', '')) limit 1;
  end if;
  if v_uid is null then raise exception 'no user matches %', v_q; end if;

  return public._grant_creator(v_uid, p_handle, p_team_id);
end $$;
grant execute on function public.admin_grant_creator(text, text, uuid) to authenticated;

-- ── 6. search: verified creators by name, handle, or team ────────────────
-- Only verified creators come back, so anything this returns outranks an
-- unverified room by construction. Direct name/handle hits first, then the
-- team's creators, then the rest.
create or replace function public.search_creators(p_search text, p_limit int default 10)
returns table (
  huddle_id uuid, name text, member_count int, team_name text, team_logo_url text,
  creator_name text, x_handle text, is_member boolean, rank int
)
language sql security definer set search_path = public stable as $$
  with q as (select '%' || lower(trim(p_search)) || '%' as pat, lower(regexp_replace(trim(p_search), '^@', '')) as raw)
  select h.id, h.name, coalesce(h.member_count, 0), trim(coalesce(t.city,'') || ' ' || coalesce(t.name,'')),
         t.logo_url, p.display_name, p.x_handle,
         exists (select 1 from public.huddle_members m where m.huddle_id = h.id and m.user_id = auth.uid()),
         case
           when lower(p.x_handle) = q.raw or lower(coalesce(p.display_name,'')) = q.raw then 0
           when lower(p.x_handle) like q.pat or lower(coalesce(p.display_name,'')) like q.pat then 1
           when lower(coalesce(t.name,'')) like q.pat or lower(coalesce(t.city,'')) like q.pat
             or lower(coalesce(t.city,'') || ' ' || coalesce(t.name,'')) like q.pat then 2
           else 3
         end as rank
    from q, public.profiles p
    join public.huddles h on h.owner_id = p.user_id and lower(h.x_handle) = lower(p.x_handle)
    left join public.teams t on t.id = h.team_id
   where p.verified_creator
     and coalesce(trim(p_search), '') <> ''
     and coalesce(h.is_game_room, false) = false and coalesce(h.is_dm, false) = false
     and (lower(p.x_handle) like q.pat or lower(coalesce(p.display_name,'')) like q.pat
          or lower(h.name) like q.pat
          or lower(coalesce(t.name,'')) like q.pat or lower(coalesce(t.city,'')) like q.pat
          or lower(coalesce(t.city,'') || ' ' || coalesce(t.name,'')) like q.pat)
   order by rank, coalesce(h.member_count, 0) desc
   limit greatest(1, least(coalesce(p_limit, 10), 25));
$$;
grant execute on function public.search_creators(text, int) to anon, authenticated;
