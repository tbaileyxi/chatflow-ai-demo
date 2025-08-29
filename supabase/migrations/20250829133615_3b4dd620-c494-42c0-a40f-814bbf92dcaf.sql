-- First, check if the user exists and create admin role
DO $$
DECLARE
    admin_user_id UUID;
BEGIN
    -- Try to find user by email (this assumes they've signed up already)
    -- Since we can't directly access auth.users, we'll create the admin setup
    -- that allows the first user to become admin via the UI
    
    -- Create a function to set up the first admin
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
    
    -- If no user found, we'll let them use the FirstAdminSetup component
    
END $$;