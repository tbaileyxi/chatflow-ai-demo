-- Add foreign key constraint to link huddle_messages.user_id to profiles.user_id
ALTER TABLE public.huddle_messages 
ADD CONSTRAINT fk_huddle_messages_user_id 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id);