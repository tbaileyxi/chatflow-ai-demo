-- Fix RLS policy issues and enable admin broadcasting

-- First, drop the problematic policies that are causing infinite recursion
DROP POLICY IF EXISTS "Huddle owners can manage members" ON public.huddle_members;
DROP POLICY IF EXISTS "Members can view huddle membership" ON public.huddle_members;

-- Create simpler, non-recursive policies for huddle_members
CREATE POLICY "Users can join huddles" ON public.huddle_members
FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view huddle members" ON public.huddle_members
FOR SELECT 
USING (true);

CREATE POLICY "Huddle owners can manage members" ON public.huddle_members
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.huddles 
    WHERE huddles.id = huddle_id 
    AND huddles.owner_id = auth.uid()
  )
);

-- Fix posts table policies to allow admin broadcasting
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.posts;

CREATE POLICY "Posts are viewable by everyone" ON public.posts
FOR SELECT 
USING (true);

CREATE POLICY "Admins can create posts" ON public.posts
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

CREATE POLICY "Authors can update their posts" ON public.posts
FOR UPDATE 
USING (author_id = auth.uid());

CREATE POLICY "Admins can update any posts" ON public.posts
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Ensure admin users can perform all operations on posts
CREATE POLICY "Admins can delete posts" ON public.posts
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);