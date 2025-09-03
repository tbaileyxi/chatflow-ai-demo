
-- Allow admins to view all huddles (so they can broadcast to any huddle)
CREATE POLICY "Admins can view all huddles"
  ON public.huddles
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));
