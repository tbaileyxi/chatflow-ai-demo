-- Fix existing Alabama testing huddle by creating missing subscription record
INSERT INTO public.huddle_subscriptions (huddle_id, owner_id, status, expires_at)
SELECT 
  '5aa508be-8a2c-4c7c-90ec-a7cad30db0c1'::uuid,
  owner_id,
  'active',
  (NOW() + INTERVAL '1 year')
FROM public.huddles 
WHERE id = '5aa508be-8a2c-4c7c-90ec-a7cad30db0c1'
  AND NOT EXISTS (
    SELECT 1 FROM public.huddle_subscriptions 
    WHERE huddle_id = '5aa508be-8a2c-4c7c-90ec-a7cad30db0c1'
  );