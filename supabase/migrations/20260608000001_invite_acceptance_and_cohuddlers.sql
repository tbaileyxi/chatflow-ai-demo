-- Build 7 social layer: invite acceptance, auto friend connection, co-huddler graph.
-- Tables already exist (friend_connections, room_invites). This adds the RPC + queries.

-- ============================================================
-- 1. accept_room_invite(invite_code)
--    Single transaction: validate invite, add to huddle, auto-connect inviter ↔ acceptor.
--    Returns the huddle_id so the client can route immediately.
-- ============================================================

create or replace function public.accept_room_invite(p_invite_code text)
returns table(huddle_id uuid, inviter_id uuid, already_member boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_invite record;
  v_already_member boolean := false;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- Look up the invite. Allow null expires_at = never expires.
  select id, huddle_id, inviter_id, accepted_at, expires_at
    into v_invite
  from public.room_invites
  where invite_code = p_invite_code
  limit 1;

  if not found then
    raise exception 'invite not found' using errcode = '02000';
  end if;

  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'invite expired' using errcode = '22023';
  end if;

  -- Check membership first.
  select exists (
    select 1 from public.huddle_members
    where huddle_members.huddle_id = v_invite.huddle_id
      and huddle_members.user_id = v_user_id
  ) into v_already_member;

  if not v_already_member then
    insert into public.huddle_members (huddle_id, user_id)
    values (v_invite.huddle_id, v_user_id);

    -- Auto-bump huddle member_count if the column exists.
    update public.huddles
       set member_count = coalesce(member_count, 0) + 1
     where id = v_invite.huddle_id;
  end if;

  -- Mark this invite consumed (don't overwrite earlier acceptor).
  update public.room_invites
     set accepted_by = coalesce(accepted_by, v_user_id),
         accepted_at = coalesce(accepted_at, now())
   where id = v_invite.id;

  -- Auto-create the 1st-degree friend connection. Idempotent via unique pair index.
  -- Skip if inviter and acceptor are the same user.
  if v_invite.inviter_id <> v_user_id then
    insert into public.friend_connections (requester_id, addressee_id, status, source, accepted_at)
    values (v_invite.inviter_id, v_user_id, 'accepted', 'invite_link', now())
    on conflict do nothing;
  end if;

  huddle_id := v_invite.huddle_id;
  inviter_id := v_invite.inviter_id;
  already_member := v_already_member;
  return next;
end;
$$;

grant execute on function public.accept_room_invite(text) to authenticated;

-- ============================================================
-- 2. co_huddlers(p_user_id, p_limit)
--    Returns users who share at least one huddle with the caller, ranked by
--    shared-huddle count. Used by the in-app "Pull in" picker.
-- ============================================================

create or replace function public.co_huddlers(p_limit integer default 50)
returns table(
  user_id uuid,
  shared_huddles integer
)
language sql
security definer
set search_path = public
as $$
  with me as (
    select huddle_id from public.huddle_members where user_id = auth.uid()
  )
  select hm.user_id, count(*)::int as shared_huddles
    from public.huddle_members hm
    join me on me.huddle_id = hm.huddle_id
   where hm.user_id <> auth.uid()
   group by hm.user_id
   order by shared_huddles desc, hm.user_id
   limit p_limit;
$$;

grant execute on function public.co_huddlers(integer) to authenticated;

-- ============================================================
-- 3. create_room_invite_code(huddle_id) RPC
--    Lets the client mint a fresh invite code without exposing INSERT to
--    arbitrary inviter_ids. Returns the code for use in the share URL.
-- ============================================================

create or replace function public.create_room_invite_code(p_huddle_id uuid)
returns table(invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text;
  v_is_member boolean;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- Inviter must be a member of the huddle.
  select exists (
    select 1 from public.huddle_members
     where huddle_id = p_huddle_id and user_id = v_user_id
  ) into v_is_member;

  if not v_is_member then
    raise exception 'not a member of this huddle' using errcode = '42501';
  end if;

  -- 16-char URL-safe code.
  v_code := encode(gen_random_bytes(12), 'base64');
  v_code := replace(replace(replace(v_code, '+', ''), '/', ''), '=', '');
  v_code := substr(v_code, 1, 12);

  insert into public.room_invites (huddle_id, inviter_id, invite_code, expires_at)
  values (p_huddle_id, v_user_id, v_code, now() + interval '14 days');

  invite_code := v_code;
  return next;
end;
$$;

grant execute on function public.create_room_invite_code(uuid) to authenticated;

-- ============================================================
-- 4. Allow ANY member (not just owner) to create invites.
--    Replaces the existing "Room owners can create room invites" policy.
-- ============================================================

drop policy if exists "Room owners can create room invites" on public.room_invites;
create policy "Members can create room invites"
on public.room_invites
for insert
with check (
  inviter_id = auth.uid()
  and exists (
    select 1 from public.huddle_members hm
    where hm.huddle_id = room_invites.huddle_id
      and hm.user_id = auth.uid()
  )
);
