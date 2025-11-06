-- Allow anyone to view pricing for verified, public huddles on the Discover page
CREATE POLICY "Anyone can view pricing for verified public huddles"
ON public.huddle_pricing
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.huddles
    WHERE huddles.id = huddle_pricing.huddle_id
      AND huddles.is_verified = true
      AND huddles.is_private = false
  )
);