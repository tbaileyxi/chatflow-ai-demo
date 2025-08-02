-- Give admin role to the specified phone number
INSERT INTO public.user_roles (user_id, role)
SELECT 
  p.user_id,
  'admin'::app_role
FROM public.profiles p
WHERE p.phone_number = '+12039456545'
ON CONFLICT (user_id, role) DO NOTHING;