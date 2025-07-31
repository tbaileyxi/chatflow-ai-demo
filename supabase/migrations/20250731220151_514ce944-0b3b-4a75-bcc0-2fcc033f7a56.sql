-- Create an admin user with phone number +1234567890
-- First, insert a user role for admin functionality
INSERT INTO public.user_roles (user_id, role) 
SELECT '00000000-0000-0000-0000-000000000001'::uuid, 'admin'::app_role
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid 
  AND role = 'admin'::app_role
);

-- Create a profile for the admin user
INSERT INTO public.profiles (user_id, display_name, phone_number, username)
SELECT 
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Admin User',
  '+1234567890',
  'admin'
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid
);