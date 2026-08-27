-- Take people out of rooms they never joined.
--
-- WHERE THESE CAME FROM: a one-time backfill (migration 20251204193824) added
-- every user to the Community room of each team they FOLLOWED. The follow list
-- has since been removed from the product, so these memberships are the residue
-- of a feature that no longer exists. Nobody opted in to them.
--
-- The rooms and every message in them are NOT touched. Only the membership rows
-- are, and only for people who never actually said anything in there.
--
-- Run STEP 1 alone first and read it. Then STEP 2 and 3 together.

-- ============ STEP 1: LOOK. Changes nothing. ============
select
  count(*) filter (where s.spoke)     as keep_they_actually_talked,
  count(*) filter (where not s.spoke) as remove_never_said_a_word,
  count(distinct hm.user_id)          as users_touched
from huddle_members hm
join huddles h
  on h.id = hm.huddle_id
 and h.is_official_team_huddle is true
cross join lateral (
  select exists (
    select 1 from huddle_messages m
    where m.huddle_id = hm.huddle_id
      and m.user_id   = hm.user_id
      and coalesce(m.is_bot_message, false) = false
  ) as spoke
) s;


-- ============ STEP 2: BACKUP, so this is undoable. ============
create table if not exists huddle_members_seeded_backup as
select hm.*, now() as backed_up_at
from huddle_members hm
join huddles h
  on h.id = hm.huddle_id
 and h.is_official_team_huddle is true
where not exists (
  select 1 from huddle_messages m
  where m.huddle_id = hm.huddle_id
    and m.user_id   = hm.user_id
    and coalesce(m.is_bot_message, false) = false
);


-- ============ STEP 3: REMOVE. ============
delete from huddle_members hm
using huddles h
where h.id = hm.huddle_id
  and h.is_official_team_huddle is true
  and not exists (
    select 1 from huddle_messages m
    where m.huddle_id = hm.huddle_id
      and m.user_id   = hm.user_id
      and coalesce(m.is_bot_message, false) = false
  );

-- member_count fixes itself: update_member_count_trigger fires on delete.
select count(*) as memberships_left_in_seeded_rooms
from huddle_members hm
join huddles h on h.id = hm.huddle_id and h.is_official_team_huddle is true;


-- ============ UNDO, if you don't like it ============
-- insert into huddle_members (huddle_id, user_id, joined_at)
-- select huddle_id, user_id, joined_at from huddle_members_seeded_backup
-- on conflict (huddle_id, user_id) do nothing;
