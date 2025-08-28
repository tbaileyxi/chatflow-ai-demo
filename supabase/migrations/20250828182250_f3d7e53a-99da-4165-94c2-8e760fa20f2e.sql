-- Add DELETE policy for huddle owners
CREATE POLICY "Owners can delete their huddles" 
ON public.huddles 
FOR DELETE 
USING (owner_id = auth.uid());