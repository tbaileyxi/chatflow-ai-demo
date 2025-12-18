-- Drop the existing UPDATE policy for accepting fades
DROP POLICY IF EXISTS "Members can accept open fades" ON public.fades;

-- Recreate with proper WITH CHECK that allows status to change to 'locked'
CREATE POLICY "Members can accept open fades" 
ON public.fades 
FOR UPDATE 
USING (
  status = 'open' 
  AND poster_id <> auth.uid() 
  AND is_huddle_member(huddle_id, auth.uid())
)
WITH CHECK (
  -- Allow the update if user is accepting (becoming accepter) and status changes to locked
  accepter_id = auth.uid() 
  AND status = 'locked' 
  AND is_huddle_member(huddle_id, auth.uid())
);