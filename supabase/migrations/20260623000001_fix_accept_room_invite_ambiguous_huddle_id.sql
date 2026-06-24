-- Fix: accept_room_invite threw "column reference huddle_id is ambiguous".
-- The RETURNS TABLE(huddle_id, inviter_id, ...) columns become variables in the
-- function body, colliding with room_invites.huddle_id / .inviter_id in the
-- SELECT INTO. Every invite acceptance failed as a result. Qualify all column
-- refs with table aliases so the names are unambiguous.

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

  -- Qualify with alias ri: bare huddle_id/inviter_id would collide with the
  -- function's OUT parameters of the same name.
  select ri.id, ri.huddle_id, ri.inviter_id, ri.accepted_at, ri.expires_at
    into v_invite
  from public.room_invites ri
  where ri.invite_code = p_invite_code
  limit 1;

  if not found then
    raise exception 'invite not found' using errcode = '02000';
  end if;

  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'invite expired' using errcode = '22023';
  end if;

  select exists (
    select 1 from public.huddle_members hm
    where hm.huddle_id = v_invite.huddle_id
      and hm.user_id = v_user_id
  ) into v_already_member;

  if not v_already_member then
    insert into public.huddle_members (huddle_id, user_id)
    values (v_invite.huddle_id, v_user_id);

    update public.huddles
       set member_count = coalesce(member_count, 0) + 1
     where id = v_invite.huddle_id;
  end if;

  update public.room_invites
     set accepted_by = coalesce(accepted_by, v_user_id),
         accepted_at = coalesce(accepted_at, now())
   where id = v_invite.id;

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
