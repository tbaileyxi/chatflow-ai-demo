-- Grant founding benefits to user who already paid
UPDATE public.profiles 
SET is_founding_member = true,
    founding_tier = 'founding',
    founding_spot_number = 4,
    founding_purchased_at = NOW(),
    has_lifetime_verified_huddle_code = true,
    verified_huddle_promo_code = 'FOUNDER2025-0004'
WHERE user_id = '48aed469-8655-42af-a28f-9fb6d0461e24'
AND is_founding_member IS NOT TRUE;