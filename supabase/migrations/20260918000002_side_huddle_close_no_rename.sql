-- CLOSING A SIDE HUDDLE DOES NOT RENAME IT.
--
-- The live closer appended " · closed" to the name and cleared expires_at.
-- Clearing the expiry is what made the app treat a closed room as a normal
-- one, so it came back in the lists — wearing "· closed", sometimes twice
-- ("New Orleans · Detroit · closed · closed"). Closed now means: private,
-- expiry kept in the past, name untouched. The app hides past-expiry rooms.
create or replace function public.close_expired_side_huddles()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  with done as (
    update public.huddles h
       set is_private = true
     where h.expires_at is not null
       and h.expires_at < now()
       and coalesce(h.is_private, false) = false
       and coalesce(h.is_official_team_huddle, false) = false
       -- Still busy? Leave it. Nothing dies mid-argument.
       and coalesce(h.last_message_at, h.created_at) < now() - interval '20 minutes'
    returning 1
  )
  select count(*) into v_n from done;
  return v_n;
end;
$$;

-- Rooms the old closer renamed: every " · closed" off the name, and an expiry
-- in the past so they stay closed.
update public.huddles
   set name = regexp_replace(name, '( · closed)+$', ''),
       expires_at = coalesce(expires_at, now()),
       is_private = true
 where name ~ ' · closed$';

select count(*) as still_named_closed from public.huddles where name ~ ' · closed$';
