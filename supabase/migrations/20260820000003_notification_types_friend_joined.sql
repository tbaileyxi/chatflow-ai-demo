-- Two notification types the product already produces but the CHECK constraint
-- rejected, so they could only ever be delivered as a push banner:
--
--   friend_joined — someone you know is now on Side Huddle. This is the signal
--                   that was missing entirely: people joined and nobody who
--                   knew them ever found out.
--   huddle_ping   — "Rally the huddle" fired a push but wrote no in-app row,
--                   so a dismissed banner meant the rally never happened as far
--                   as the recipient could tell.

ALTER TABLE public.notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
ADD CONSTRAINT notifications_type_check
CHECK (
  type IN (
    'game_start',
    'score_update',
    'game_end',
    'period_change',
    'presence_active',
    'new_message',
    'member_joined',
    'room_invite',
    'bot_drop',
    'kalshi_closing',
    'pick_result',
    'friend_joined',
    'huddle_ping'
  )
);
