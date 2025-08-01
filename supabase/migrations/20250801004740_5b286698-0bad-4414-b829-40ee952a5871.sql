-- Fix RLS policy for huddle_messages to properly allow Team Agent broadcasts

-- Update the INSERT policy for huddle_messages to allow Team Agent messages
DROP POLICY IF EXISTS "Users can insert messages in huddles they're members of" ON public.huddle_messages;

CREATE POLICY "Users can insert messages in huddles they're members of" 
ON public.huddle_messages 
FOR INSERT 
WITH CHECK (
  -- Allow team agent messages from any authenticated user
  is_team_agent_message = true
  OR 
  -- Allow regular users if they are members of the huddle
  (auth.uid() = user_id AND is_huddle_member(huddle_id, auth.uid()))
);