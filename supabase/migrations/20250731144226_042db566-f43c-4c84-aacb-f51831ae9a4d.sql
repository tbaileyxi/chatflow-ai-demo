-- Fix infinite recursion in huddle_members RLS policies
-- Drop existing problematic policies
DROP POLICY IF EXISTS "Members can view huddle membership" ON public.huddle_members;
DROP POLICY IF EXISTS "Huddle owners can manage members" ON public.huddle_members;
DROP POLICY IF EXISTS "Users can join huddles" ON public.huddle_members;

-- Create new policies without recursion
CREATE POLICY "Users can join huddles they have access to" 
ON public.huddle_members 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own memberships" 
ON public.huddle_members 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Huddle owners can manage their huddle members" 
ON public.huddle_members 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.huddles 
    WHERE huddles.id = huddle_members.huddle_id 
    AND huddles.owner_id = auth.uid()
  )
);