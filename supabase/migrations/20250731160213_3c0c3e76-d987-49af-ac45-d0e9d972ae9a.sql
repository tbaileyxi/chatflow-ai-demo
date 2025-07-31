-- Create huddle_messages table
CREATE TABLE public.huddle_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  huddle_id UUID NOT NULL,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on huddle_messages table
ALTER TABLE public.huddle_messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for huddle_messages
CREATE POLICY "Users can view messages in huddles they're members of" 
ON public.huddle_messages 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.huddle_members 
    WHERE huddle_id = huddle_messages.huddle_id 
    AND user_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM public.huddles 
    WHERE id = huddle_messages.huddle_id 
    AND owner_id = auth.uid()
  )
);

CREATE POLICY "Users can insert messages in huddles they're members of" 
ON public.huddle_messages 
FOR INSERT 
WITH CHECK (
  user_id = auth.uid() AND
  (EXISTS (
    SELECT 1 FROM public.huddle_members 
    WHERE huddle_id = huddle_messages.huddle_id 
    AND user_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM public.huddles 
    WHERE id = huddle_messages.huddle_id 
    AND owner_id = auth.uid()
  ))
);