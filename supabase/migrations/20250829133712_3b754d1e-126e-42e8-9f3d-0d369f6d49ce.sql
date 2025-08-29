-- Clean up duplicate user roles and set up admin properly
-- First, remove duplicates keeping the latest one
DELETE FROM public.user_roles 
WHERE id NOT IN (
    SELECT DISTINCT ON (user_id) id
    FROM public.user_roles
    ORDER BY user_id, created_at DESC
);

-- Add the unique constraint
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);

-- Now set up admin for the first user
INSERT INTO public.user_roles (user_id, role)
SELECT 
    p.user_id,
    'admin'::app_role
FROM public.profiles p
ORDER BY p.created_at ASC
LIMIT 1
ON CONFLICT (user_id) DO UPDATE SET role = 'admin'::app_role;