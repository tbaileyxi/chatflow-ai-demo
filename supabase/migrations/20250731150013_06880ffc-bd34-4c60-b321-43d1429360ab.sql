-- Fix infinite recursion in huddles RLS policies by using security definer function
-- Drop existing problematic policies
DROP POLICY IF EXISTS "Members can view their huddles" ON public.huddles;

-- Create security definer function to check huddle membership
CREATE OR REPLACE FUNCTION public.is_huddle_member(_huddle_id uuid, _user_id uuid)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.huddle_members 
    WHERE huddle_id = _huddle_id AND user_id = _user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create new non-recursive policy
CREATE POLICY "Members can view their huddles" 
ON public.huddles 
FOR SELECT 
USING (
  NOT is_private OR 
  owner_id = auth.uid() OR 
  public.is_huddle_member(id, auth.uid())
);

-- Add missing RLS policies for post_reactions to enable voting
CREATE POLICY "Users can create reactions" 
ON public.post_reactions 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own reactions" 
ON public.post_reactions 
FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own reactions" 
ON public.post_reactions 
FOR DELETE 
USING (user_id = auth.uid());

-- Add RLS policies for poll voting (store votes in poll_data JSONB)
-- First, let's add a poll_votes table to track votes properly
CREATE TABLE IF NOT EXISTS public.poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL,
  user_id UUID NOT NULL,
  option_id INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Enable RLS on poll_votes
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

-- Add policies for poll_votes
CREATE POLICY "Users can view all poll votes" 
ON public.poll_votes 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create their own votes" 
ON public.poll_votes 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own votes" 
ON public.poll_votes 
FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own votes" 
ON public.poll_votes 
FOR DELETE 
USING (user_id = auth.uid());