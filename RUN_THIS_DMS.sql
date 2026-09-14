-- Direct messages, as a huddle with two people in it.
--
-- A DM is a thread between two people, which is what a huddle already is. So
-- it IS one — flagged is_dm, no team, two members — and it inherits the
-- composer, the camera, presence, notifications, delete, report and realtime
-- without a line of new code. A separate messages table would have meant
-- rebuilding every one of those badly.
--
-- CONNECTED PEOPLE ONLY. Open DMs from strangers in public game huddles is a
-- harassment surface, and we built auto-hide last week precisely because
-- strangers can now talk to you.

alter table public.huddles add column if not exists is_dm boolean not null default false;

-- A DM has no team. The column has been NOT NULL since every huddle was
-- attached to one; a conversation between two people is the first thing that
-- honestly isn't.
alter table public.huddles alter column team_id drop not null;

create index if not exists huddles_is_dm_idx on public.huddles (is_dm) where is_dm;

create or replace function public.open_dm(p_other_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me    uuid := auth.uid();
  v_id    uuid;
  v_name  text;
begin
  if v_me is null then raise exception 'Not signed in'; end if;
  if v_me = p_other_user then raise exception 'You cannot message yourself'; end if;

  -- Connected only, in either direction.
  if not exists (
    select 1 from public.friend_connections f
     where f.status = 'accepted'
       and ((f.requester_id = v_me and f.addressee_id = p_other_user)
         or (f.addressee_id = v_me and f.requester_id = p_other_user))
  ) then
    raise exception 'You can only message people you are connected to';
  end if;

  -- The existing one, if there is one: a DM both of you are in.
  select h.id into v_id
    from public.huddles h
   where h.is_dm
     and exists (select 1 from public.huddle_members m
                  where m.huddle_id = h.id and m.user_id = v_me)
     and exists (select 1 from public.huddle_members m
                  where m.huddle_id = h.id and m.user_id = p_other_user)
   limit 1;

  if v_id is not null then return v_id; end if;

  -- The name is THEIRS, because a thread is named for who is in it. Each side
  -- renders the other's name from membership rather than reading this, so it
  -- is only ever a fallback.
  select coalesce(p.display_name, p.username, 'Direct message')
    into v_name from public.profiles p where p.user_id = p_other_user;

  insert into public.huddles (name, team_id, owner_id, is_private, is_dm)
  values (coalesce(v_name, 'Direct message'), null, v_me, true, true)
  returning id into v_id;

  insert into public.huddle_members (huddle_id, user_id)
  values (v_id, v_me), (v_id, p_other_user)
  on conflict do nothing;

  return v_id;
end;
$$;

grant execute on function public.open_dm(uuid) to authenticated;
