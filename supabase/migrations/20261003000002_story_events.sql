-- Counting what a story actually did, because that is the thing being sold.
--
-- The pitch stopped being "we have users" and became "we have reach", and
-- reach has to be a number or it is a feeling. These are the only three
-- moments this app can honestly witness.
--
-- THREE EVENTS, DELIBERATELY NOT ONE.
--
--   shared       someone tapped share AND the sheet reported it completed.
--                Share.share() returns sharedAction vs dismissedAction, so
--                this is a real send, not an opened sheet. It does NOT say
--                where it went: iOS never tells us, and anyone reporting
--                this as "shares to X" is making it up.
--   link_opened  somebody loaded the story page on the web. OUR server, our
--                count, the only one of the three that measures a stranger
--                rather than a member.
--   downloaded   the browser finished rendering the video and handed it over.
--                The last moment we can see; after this the file is on a
--                phone and everything it does is invisible to us.
--
-- WHAT IS NOT HERE, AND CANNOT BE. Views on TikTok, X or Instagram. Once the
-- file leaves there is no pixel and no callback. A sponsor quoted a number
-- from those platforms is a sponsor who will eventually ask to see it.

create table if not exists public.story_events (
  id         uuid primary key default gen_random_uuid(),
  huddle_id  uuid not null references public.huddles(id) on delete cascade,
  kind       text not null check (kind in ('shared', 'link_opened', 'downloaded')),
  -- Null for the web, where nobody is signed in. That is the point of the
  -- web count: it is the people who are not us yet.
  user_id    uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists story_events_huddle_idx
  on public.story_events(huddle_id, created_at desc);
create index if not exists story_events_kind_idx
  on public.story_events(kind, created_at desc);

alter table public.story_events enable row level security;

-- NOBODY WRITES THIS TABLE DIRECTLY.
--
-- The web page is anonymous, so logging from it would mean granting anon an
-- insert on a real table. It goes through the function below instead, which
-- can only ever write these three kinds against a huddle that exists.
revoke all on public.story_events from anon, authenticated;

drop policy if exists "Admins read story events" on public.story_events;
create policy "Admins read story events" on public.story_events
  for select using (public.has_role(auth.uid(), 'admin'));

create or replace function public.log_story_event(p_huddle_id uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_kind not in ('shared', 'link_opened', 'downloaded') then
    return;
  end if;
  -- A story event for a room that does not exist is noise, not data.
  if not exists (select 1 from public.huddles h where h.id = p_huddle_id) then
    return;
  end if;
  insert into public.story_events (huddle_id, kind, user_id)
  values (p_huddle_id, p_kind, auth.uid());
end $$;

-- Counting must never be the reason a share fails, so this returns void and
-- raises nothing the caller has to handle.
grant execute on function public.log_story_event(uuid, text) to anon, authenticated;

/**
 * The three numbers, for one room or for everything.
 *
 * Null huddle_id means the whole app, which is the figure that goes in a
 * sponsor conversation — a partner buys the team's room, but what they want
 * to know first is whether any of this travels at all.
 */
create or replace function public.story_counts(p_huddle_id uuid default null, p_days integer default 30)
returns table (shared integer, link_opened integer, downloaded integer)
language sql
security definer
set search_path = public
stable
as $$
  with window_events as (
    select kind from public.story_events e
     where e.created_at > now() - make_interval(days => greatest(p_days, 1))
       and (p_huddle_id is null or e.huddle_id = p_huddle_id)
  )
  select
    count(*) filter (where kind = 'shared')::integer,
    count(*) filter (where kind = 'link_opened')::integer,
    count(*) filter (where kind = 'downloaded')::integer
  from window_events;
$$;

revoke all on function public.story_counts(uuid, integer) from public, anon;
grant execute on function public.story_counts(uuid, integer) to authenticated;
