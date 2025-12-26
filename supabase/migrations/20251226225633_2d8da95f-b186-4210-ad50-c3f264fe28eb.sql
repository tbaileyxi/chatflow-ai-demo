-- Fix: Allow authenticated users to post messages in public huddles (not just members)
DROP POLICY IF EXISTS "Users can insert messages in huddles they're members of" ON public.huddle_messages;

CREATE POLICY "Users can insert messages in accessible huddles"
ON public.huddle_messages
FOR INSERT
WITH CHECK (
  (is_team_agent_message = true) 
  OR (
    auth.uid() = user_id 
    AND (
      -- Member of the huddle
      is_huddle_member(huddle_id, auth.uid())
      -- OR it's a public/official team huddle
      OR EXISTS (
        SELECT 1 FROM public.huddles h 
        WHERE h.id = huddle_id 
        AND (h.is_private = false OR h.is_official_team_huddle = true)
      )
    )
  )
);