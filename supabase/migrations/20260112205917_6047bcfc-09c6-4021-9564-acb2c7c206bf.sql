-- Fix RLS policy for inserting fades - allow authenticated users to post fades
DROP POLICY IF EXISTS "Users can create fades" ON public.fades;
DROP POLICY IF EXISTS "Authenticated users can create fades" ON public.fades;

-- Create permissive INSERT policy for authenticated users
CREATE POLICY "Authenticated users can create fades"
ON public.fades
FOR INSERT
TO authenticated
WITH CHECK (poster_id = auth.uid());

-- Also ensure update policy allows accepting fades
DROP POLICY IF EXISTS "Users can accept open fades" ON public.fades;
DROP POLICY IF EXISTS "Users can update their own fades" ON public.fades;
DROP POLICY IF EXISTS "Participants can update settlement" ON public.fades;

-- Policy for accepting fades (setting accepter_id and status to locked)
CREATE POLICY "Users can accept open fades"
ON public.fades
FOR UPDATE
TO authenticated
USING (
  status = 'open' AND poster_id != auth.uid()
)
WITH CHECK (
  accepter_id = auth.uid() AND status = 'locked'
);

-- Policy for poster to update their own fades
CREATE POLICY "Poster can update own fades"
ON public.fades
FOR UPDATE
TO authenticated
USING (poster_id = auth.uid());

-- Policy for participants to update settlement status
CREATE POLICY "Participants can update settlement"
ON public.fades
FOR UPDATE
TO authenticated
USING (
  poster_id = auth.uid() OR accepter_id = auth.uid()
)
WITH CHECK (
  poster_id = auth.uid() OR accepter_id = auth.uid()
);