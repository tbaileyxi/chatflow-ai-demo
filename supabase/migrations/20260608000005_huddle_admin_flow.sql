-- Build 8: unify the "is this huddle Official?" check + dev-time admin flip RPC.

-- ============================================================
-- 1. is_app_admin flag on profiles. Only admins can flip huddles Official
--    without going through the (future) payment flow.
-- ============================================================
alter table public.profiles
  add column if not exists is_app_admin boolean not null default false;

-- ============================================================
-- 2. RPC: flip_huddle_official_status(huddle_id, new_status)
--    Permission rules:
--      - app admin can flip any huddle
--      - huddle owner can flip ONLY back to 'inactive' (e.g. self-cancel)
--    No payment integration yet.
-- ============================================================
create or replace function public.flip_huddle_official_status(
  p_huddle_id uuid,
  p_status text
)
returns table(huddle_id uuid, official_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_admin boolean := false;
  v_is_owner boolean := false;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_status not in ('inactive', 'active', 'past_due', 'cancelled') then
    raise exception 'invalid status %', p_status using errcode = '22023';
  end if;

  select coalesce(is_app_admin, false) into v_is_admin
    from public.profiles where user_id = v_user_id;

  select (owner_id = v_user_id) into v_is_owner
    from public.huddles where id = p_huddle_id;

  if not v_is_admin and not (v_is_owner and p_status in ('inactive', 'cancelled')) then
    raise exception 'not permitted' using errcode = '42501';
  end if;

  update public.huddles
     set official_status = p_status
   where id = p_huddle_id;

  huddle_id := p_huddle_id;
  official_status := p_status;
  return next;
end;
$$;

grant execute on function public.flip_huddle_official_status(uuid, text) to authenticated;

-- ============================================================
-- 3. Convenience view: huddles_with_official
--    Adds is_official boolean = (official_status = 'active' OR is_official_team_huddle).
--    Clients SHOULD read official_status directly; this is for older paths.
-- ============================================================
create or replace view public.huddles_with_official as
select
  h.*,
  (h.official_status = 'active' or coalesce(h.is_official_team_huddle, false)) as is_official
from public.huddles h;

grant select on public.huddles_with_official to authenticated, anon;
