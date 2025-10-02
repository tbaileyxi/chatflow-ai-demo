-- Create message heat reactions table
CREATE TABLE IF NOT EXISTS public.message_heat_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.huddle_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);

-- Enable RLS
ALTER TABLE public.message_heat_reactions ENABLE ROW LEVEL SECURITY;

-- Users can view heat reactions in their huddles
CREATE POLICY "Users can view heat reactions in their huddles"
ON public.message_heat_reactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.huddle_messages hm
    JOIN public.huddles h ON hm.huddle_id = h.id
    WHERE hm.id = message_heat_reactions.message_id
    AND is_huddle_member(h.id, auth.uid())
  )
);

-- Users can add heat reactions to messages in their huddles
CREATE POLICY "Users can add heat reactions"
ON public.message_heat_reactions
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.huddle_messages hm
    JOIN public.huddles h ON hm.huddle_id = h.id
    WHERE hm.id = message_heat_reactions.message_id
    AND is_huddle_member(h.id, auth.uid())
  )
);

-- Users can remove their own heat reactions
CREATE POLICY "Users can remove their heat"
ON public.message_heat_reactions
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX idx_message_heat_reactions_message_id ON public.message_heat_reactions(message_id);
CREATE INDEX idx_message_heat_reactions_user_id ON public.message_heat_reactions(user_id);

-- Add realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_heat_reactions;