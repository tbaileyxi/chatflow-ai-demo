-- Fix RLS policy for huddle_messages to allow TEAM AGENT broadcasts
DROP POLICY IF EXISTS "Users can insert messages in huddles they're members of" ON public.huddle_messages;

CREATE POLICY "Users can insert messages in huddles they're members of" 
ON public.huddle_messages 
FOR INSERT 
WITH CHECK (
  -- Allow TEAM AGENT (system user) to insert into any huddle
  auth.uid() = '00000000-0000-0000-0000-000000000000'::uuid 
  OR 
  -- Allow regular users to insert into huddles they're members of
  (auth.uid() = user_id AND is_huddle_member(huddle_id, auth.uid()))
);

-- Add unique constraint to prevent duplicate posts
ALTER TABLE public.posts 
ADD CONSTRAINT unique_posts_content_team_time 
UNIQUE (content, team_id, created_at);

-- Add index for better performance on scheduled posts
CREATE INDEX IF NOT EXISTS idx_posts_scheduled_at ON public.posts(scheduled_at) WHERE scheduled_at IS NOT NULL;