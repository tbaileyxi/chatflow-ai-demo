-- Add unique constraint for user_roles if not exists and setup admin
DO $$
BEGIN
    -- Add unique constraint on user_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_roles_user_id_unique'
    ) THEN
        ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);
    END IF;
END $$;

-- Now try to create admin for tbailey user or first user
INSERT INTO public.user_roles (user_id, role)
SELECT 
    p.user_id,
    'admin'::app_role
FROM public.profiles p
WHERE LOWER(p.display_name) LIKE '%tbailey%' 
   OR p.user_id IN (
       SELECT user_id FROM public.profiles 
       WHERE created_at = (SELECT MIN(created_at) FROM public.profiles)
   )
ON CONFLICT (user_id) DO UPDATE SET role = 'admin'::app_role;