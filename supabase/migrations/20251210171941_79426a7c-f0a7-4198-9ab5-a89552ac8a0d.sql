-- Manually update Chris's founding member status since webhook didn't fire
UPDATE public.profiles
SET 
  is_founding_member = true,
  founding_tier = 'charter',
  founding_spot_number = (SELECT COALESCE(MAX(founding_spot_number), 0) + 1 FROM profiles WHERE is_founding_member = true),
  has_lifetime_verified_huddle_code = true,
  verified_huddle_promo_code = 'FOUNDER2025-' || LPAD((SELECT COALESCE(MAX(founding_spot_number), 0) + 1 FROM profiles WHERE is_founding_member = true)::text, 4, '0'),
  founding_purchased_at = now()
WHERE user_id = '84de1ff4-173b-4d3d-b616-3c6b27975471';