-- The index every read of every message goes through.
--
-- The row-level policy on huddle_messages is, for each row considered:
--
--   exists (select 1 from huddle_members
--            where huddle_id = huddle_messages.huddle_id
--              and user_id = auth.uid())
--
-- huddle_members has a primary key on `id` and NOTHING ELSE — no index on
-- huddle_id, none on user_id. So that subquery is a sequential scan of the
-- members table, evaluated per message row, on every read of a room.
--
-- At 60 members it is invisible. It scales as members × messages, which is
-- exactly the shape of a busy room during a game: the two numbers that grow
-- are the two being multiplied. This is the difference between chat being
-- fast when nobody is using it and fast when everybody is.
--
-- The same subquery shape appears in the policies on huddles, reactions and
-- reads, so one index pays for all of them.

create index if not exists huddle_members_room_user_idx
  on public.huddle_members (huddle_id, user_id);

-- "Which rooms am I in" — Home asks this on every launch.
create index if not exists huddle_members_user_idx
  on public.huddle_members (user_id);

analyze public.huddle_members;

select
  (select count(*) from public.huddle_members) as members,
  (select count(*) from pg_indexes
     where tablename = 'huddle_members'
       and indexname in ('huddle_members_room_user_idx','huddle_members_user_idx')) as indexes_installed;  -- expect 2
