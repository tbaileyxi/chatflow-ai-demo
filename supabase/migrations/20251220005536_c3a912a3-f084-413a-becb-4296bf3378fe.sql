-- Fix existing verified huddles to show in discovery
-- They need is_private = false to appear in the search
UPDATE public.huddles
SET is_private = false
WHERE is_verified = true
AND is_private = true;