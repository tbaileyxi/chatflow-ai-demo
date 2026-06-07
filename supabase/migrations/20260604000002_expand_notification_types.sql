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
    'pick_result'
  )
);
