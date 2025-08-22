-- Drop the existing restrictive SELECT policy and create a more permissive one
DROP POLICY IF EXISTS "Users can view vote counts only" ON public.spotlight_votes;

-- Allow users to view all votes (needed for calculating scores)
CREATE POLICY "Users can view all votes" 
ON public.spotlight_votes 
FOR SELECT 
USING (true);