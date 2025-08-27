-- Create a sample verified huddle for testing
-- First, let's create a test team if it doesn't exist
INSERT INTO public.teams (id, name, city, league, logo_url)
VALUES (
  gen_random_uuid(),
  'Browns', 
  'Cleveland', 
  'NFL',
  'https://logoeps.com/wp-content/uploads/2013/03/cleveland-browns-vector-logo.png'
) ON CONFLICT (name, city) DO NOTHING;

-- Get the Browns team ID and admin user ID for the sample huddle
DO $$ 
DECLARE
  team_id_var UUID;
  admin_user_id UUID;
  huddle_id_var UUID;
BEGIN
  -- Get Browns team ID
  SELECT id INTO team_id_var FROM public.teams WHERE name = 'Browns' AND city = 'Cleveland' LIMIT 1;
  
  -- Get admin user ID (assuming profile with username 'tbaileyxi' exists)
  SELECT user_id INTO admin_user_id FROM public.profiles WHERE username = 'tbaileyxi' LIMIT 1;
  
  -- Only proceed if both exist
  IF team_id_var IS NOT NULL AND admin_user_id IS NOT NULL THEN
    -- Create verified huddle
    INSERT INTO public.huddles (id, name, owner_id, team_id, is_verified, is_private, member_count)
    VALUES (
      gen_random_uuid(),
      'Official Browns Superfans',
      admin_user_id,
      team_id_var,
      true,
      false,
      1
    )
    RETURNING id INTO huddle_id_var;
    
    -- Create subscription record to maintain verification
    INSERT INTO public.huddle_subscriptions (
      huddle_id,
      owner_id,
      status,
      expires_at
    )
    VALUES (
      huddle_id_var,
      admin_user_id,
      'active',
      (now() + interval '1 year')
    );
    
    -- Add admin as owner/member
    INSERT INTO public.huddle_members (huddle_id, user_id)
    VALUES (huddle_id_var, admin_user_id)
    ON CONFLICT (huddle_id, user_id) DO NOTHING;
    
    RAISE NOTICE 'Created verified huddle: Official Browns Superfans';
  ELSE
    RAISE NOTICE 'Admin user tbaileyxi not found or Browns team not found';
  END IF;
END $$;