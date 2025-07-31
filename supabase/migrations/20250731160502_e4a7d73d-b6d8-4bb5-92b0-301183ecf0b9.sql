-- Remove the foreign key constraint that's causing the issue
ALTER TABLE public.huddle_messages 
DROP CONSTRAINT fk_huddle_messages_user_id;