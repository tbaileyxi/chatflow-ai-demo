-- Create TEAM AGENT profile for broadcast messages
INSERT INTO public.profiles (user_id, display_name, username, bio)
VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid,
  'TEAM AGENT',
  'team_agent',
  'Official team communications agent'
) ON CONFLICT (user_id) DO UPDATE SET
  display_name = 'TEAM AGENT',
  username = 'team_agent',
  bio = 'Official team communications agent';

-- Add team_agent_message flag to huddle_messages for proper attribution
ALTER TABLE public.huddle_messages 
ADD COLUMN IF NOT EXISTS is_team_agent_message boolean DEFAULT false;

-- Add team_agent_message flag to posts for proper attribution  
ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS is_team_agent_message boolean DEFAULT false;

-- Create index for better performance on team agent queries
CREATE INDEX IF NOT EXISTS idx_huddle_messages_team_agent ON public.huddle_messages(is_team_agent_message);
CREATE INDEX IF NOT EXISTS idx_posts_team_agent ON public.posts(is_team_agent_message);