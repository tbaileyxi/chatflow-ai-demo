-- 'join_request' — someone asked to be let into a room you own.
--
-- The request-to-join flow, its table, and the whole approve/deny admin UI were
-- already built, but nothing ever told the owner a request had arrived. The
-- only way to find one was to open room settings on the off chance. Adding the
-- type so the notification can be filed in the bell as well as pushed.

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
    'huddle_ping',
    'join_request'
  )
);
