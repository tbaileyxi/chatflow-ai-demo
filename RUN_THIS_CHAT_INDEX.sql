-- The index every message in this product has been missing.
--
-- huddle_messages has indexes on reply_to_id, is_team_agent_message, a pulse
-- partial and a hidden partial. It has NEVER had one on (huddle_id,
-- created_at) — which is the only access pattern chat actually has.
--
-- So every one of these scans and sorts the whole table, now 27,515 rows:
--
--   • opening a room:  where huddle_id = ? order by created_at desc limit 50
--   • loading more:    the same, paged
--   • AND, worst of all, the on_coach_mention trigger, which runs
--       select ... where huddle_id = ? and id <> ? order by created_at desc limit 1
--     on EVERY INSERT — so sending a message pays for a full sort of the
--     message table BEFORE the insert can return. Measured at 1 to 6 seconds
--     against an idle database and reported at thirty on a busy one.
--
-- Cheap to build at this size, and it turns all three into an index lookup.

create index if not exists huddle_messages_room_time_idx
  on public.huddle_messages (huddle_id, created_at desc);

analyze public.huddle_messages;

select
  (select count(*) from public.huddle_messages) as messages,
  (select count(*) from pg_indexes
     where tablename = 'huddle_messages'
       and indexname = 'huddle_messages_room_time_idx') as index_installed;  -- expect 1
