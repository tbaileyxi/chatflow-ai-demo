-- Fix RLS policy for huddle_messages to allow Team Agent broadcasts

-- Update the INSERT policy for huddle_messages to allow Team Agent user
DROP POLICY IF EXISTS "Users can insert messages in huddles they're members of" ON public.huddle_messages;

CREATE POLICY "Users can insert messages in huddles they're members of" 
ON public.huddle_messages 
FOR INSERT 
WITH CHECK (
  -- Allow Team Agent user (system user) to insert messages anywhere
  auth.uid() = '00000000-0000-0000-0000-000000000000'::uuid 
  OR 
  -- Allow regular users if they are members of the huddle
  (auth.uid() = user_id AND is_huddle_member(huddle_id, auth.uid()))
);