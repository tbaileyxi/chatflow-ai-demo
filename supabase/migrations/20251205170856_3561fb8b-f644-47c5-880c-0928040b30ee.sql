-- Add message_id column to poll_votes for huddle message polls
ALTER TABLE public.poll_votes 
ADD COLUMN IF NOT EXISTS message_id uuid REFERENCES public.huddle_messages(id) ON DELETE CASCADE;

-- Add unique constraint to prevent duplicate votes per user per message
ALTER TABLE public.poll_votes 
ADD CONSTRAINT poll_votes_message_user_unique UNIQUE (message_id, user_id);

-- Update RLS policies to allow voting on huddle message polls
CREATE POLICY "Users can vote on huddle message polls" 
ON public.poll_votes 
FOR INSERT 
WITH CHECK (
  user_id = auth.uid() AND 
  message_id IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM huddle_messages hm
    JOIN huddle_members hmbr ON hmbr.huddle_id = hm.huddle_id
    WHERE hm.id = poll_votes.message_id 
    AND hmbr.user_id = auth.uid()
  )
);

-- Allow users to view poll votes for messages in their huddles
CREATE POLICY "Users can view message poll votes" 
ON public.poll_votes 
FOR SELECT 
USING (
  message_id IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM huddle_messages hm
    JOIN huddle_members hmbr ON hmbr.huddle_id = hm.huddle_id
    WHERE hm.id = poll_votes.message_id 
    AND hmbr.user_id = auth.uid()
  )
);

-- Allow users to update their votes on message polls
CREATE POLICY "Users can update message poll votes" 
ON public.poll_votes 
FOR UPDATE 
USING (
  user_id = auth.uid() AND 
  message_id IS NOT NULL
);

-- Allow users to delete their votes on message polls
CREATE POLICY "Users can delete message poll votes" 
ON public.poll_votes 
FOR DELETE 
USING (
  user_id = auth.uid() AND 
  message_id IS NOT NULL
);