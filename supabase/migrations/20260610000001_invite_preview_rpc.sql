-- get_invite_preview(p_invite_code): anon-safe preview for the web invite
-- landing page (sidehuddlesports.com/i/{code}). room_invites is RLS-locked to
-- participants, so the public page needs this SECURITY DEFINER lookup. It
-- exposes only the room name, member count, and inviter display name for
-- valid, unexpired codes — nothing else.

create or replace function public.get_invite_preview(p_invite_code text)
returns table(
  huddle_name text,
  member_count integer,
  inviter_name text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    h.name as huddle_name,
    coalesce(h.member_count, 0) as member_count,
    p.display_name as inviter_name
  from public.room_invites ri
  join public.huddles h on h.id = ri.huddle_id
  left join public.profiles p on p.user_id = ri.inviter_id
  where ri.invite_code = p_invite_code
    and (ri.expires_at is null or ri.expires_at > now())
  limit 1;
$$;

grant execute on function public.get_invite_preview(text) to anon, authenticated;
