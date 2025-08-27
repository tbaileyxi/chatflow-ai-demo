-- Fix the existing Browns huddles to be public and verified
UPDATE public.huddles 
SET 
  is_private = false,
  is_verified = true
WHERE name ILIKE '%browns%' OR name ILIKE '%official%';

-- Create the missing subscription records for verification
INSERT INTO public.huddle_subscriptions (
  huddle_id,
  owner_id,
  status,
  expires_at
)
SELECT 
  h.id,
  h.owner_id,
  'active',
  (now() + interval '1 year')
FROM public.huddles h
LEFT JOIN public.huddle_subscriptions hs ON h.id = hs.huddle_id
WHERE (h.name ILIKE '%browns%' OR h.name ILIKE '%official%')
  AND hs.huddle_id IS NULL
  AND h.is_verified = true;

-- Update RLS policy for huddles to ensure public huddles are visible to everyone
DROP POLICY IF EXISTS "Anyone can view public huddles for search" ON public.huddles;
CREATE POLICY "Anyone can view public huddles for search" 
ON public.huddles
FOR SELECT 
USING (NOT is_private);