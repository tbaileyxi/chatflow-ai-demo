-- Create huddle_message_reactions table for emoji reactions
CREATE TABLE public.huddle_message_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.huddle_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL CHECK (emoji IN ('👍', '😂', '🔥')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- Enable RLS on huddle_message_reactions
ALTER TABLE public.huddle_message_reactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for huddle_message_reactions
CREATE POLICY "Users can view reactions in huddles they're members of" 
ON public.huddle_message_reactions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.huddle_messages hm
    JOIN public.huddles h ON hm.huddle_id = h.id
    WHERE hm.id = message_id
    AND public.is_huddle_member(h.id, auth.uid())
  )
);

CREATE POLICY "Users can add reactions to messages in huddles they're members of" 
ON public.huddle_message_reactions 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.huddle_messages hm
    JOIN public.huddles h ON hm.huddle_id = h.id
    WHERE hm.id = message_id
    AND public.is_huddle_member(h.id, auth.uid())
  )
);

CREATE POLICY "Users can remove their own reactions" 
ON public.huddle_message_reactions 
FOR DELETE 
USING (auth.uid() = user_id);

-- Fix RLS policies to allow TEAM AGENT to broadcast to huddles
-- Update huddle_messages policy to allow team agent posts
DROP POLICY IF EXISTS "Users can insert messages in huddles they're members of" ON public.huddle_messages;

CREATE POLICY "Users can insert messages in huddles they're members of" 
ON public.huddle_messages 
FOR INSERT 
WITH CHECK (
  -- Allow team agent to post to any huddle (for broadcasts)
  auth.uid() = '00000000-0000-0000-0000-000000000000'::uuid
  OR
  -- Allow regular users to post to huddles they're members of
  (
    auth.uid() = user_id
    AND public.is_huddle_member(huddle_id, auth.uid())
  )
);

-- Add index for better performance on reactions
CREATE INDEX idx_huddle_message_reactions_message_id ON public.huddle_message_reactions(message_id);
CREATE INDEX idx_huddle_message_reactions_user_emoji ON public.huddle_message_reactions(user_id, emoji);