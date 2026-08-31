-- Remove the bot messages that announced games which never happened.
--
-- The Knicks' last game was 2026-06-14 and no next game is scheduled, so all
-- three of these are fabrications:
--   "Game's live right now against the Cavs—tune in for the updates."
--   "Game's live right now against Dallas. Knicks-Mavs matchup..."
--   "Just caught the Magic game from last night—solid win for the squad."
--
-- News fans out to every room carrying that team, so these may exist in more
-- than one room. Matching on content catches all copies.
--
-- Only bot messages are eligible. Nothing a person wrote can match.

-- ===== STEP 1: LOOK. Changes nothing. =====
select huddle_id, created_at, left(content, 80) as message
from huddle_messages
where is_bot_message is true
  and (content like 'Game''s live right now%'
    or content like 'Just caught the Magic game%')
order by created_at desc;


-- ===== STEP 2: DELETE the rows listed above. =====
delete from huddle_messages
where is_bot_message is true
  and (content like 'Game''s live right now%'
    or content like 'Just caught the Magic game%');
