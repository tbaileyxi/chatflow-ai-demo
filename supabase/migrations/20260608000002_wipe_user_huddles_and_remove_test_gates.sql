-- Clean slate for user-created huddles. Keeps auto-created team community rooms
-- (is_official_team_huddle = true) so the bot v2 still has post targets.
--
-- ALSO: drop the deprecated huddle_chatbot_settings rows tied to deleted huddles;
-- everything else cascades via FK constraints.

-- Safety: don't touch officials. Don't touch system_user-owned rooms.
with deletable as (
  select id from public.huddles
  where coalesce(is_official_team_huddle, false) = false
)
delete from public.huddles where id in (select id from deletable);

-- Cleanup any orphaned join_requests / room_invites that referenced deleted huddles.
-- (FKs are ON DELETE CASCADE so this is belt-and-suspenders.)
delete from public.huddle_join_requests
 where huddle_id not in (select id from public.huddles);

delete from public.room_invites
 where huddle_id not in (select id from public.huddles);
