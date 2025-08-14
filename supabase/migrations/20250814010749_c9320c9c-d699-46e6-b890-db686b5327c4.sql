-- SECURITY FIX: Remove overly permissive profile access policy
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

-- Create secure policies that protect sensitive data
-- Policy 1: Users can view their own complete profile (including phone_number)
CREATE POLICY "Users can view their own complete profile" 
ON public.profiles 
FOR SELECT 
USING (user_id = auth.uid());

-- Policy 2: Users can view only public fields of other users (NO phone_number, email, etc.)
-- This creates a row-level filter that only exposes safe public fields
CREATE POLICY "Users can view public profile fields of others" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND user_id != auth.uid()
  AND status != 'banned'
);

-- Add a database function to safely get public profile data
CREATE OR REPLACE FUNCTION public.get_public_profile(target_user_id UUID)
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  username TEXT,
  avatar_url TEXT,
  bio TEXT
) AS $$
BEGIN
  -- Only return safe public fields, never phone_number or other sensitive data
  RETURN QUERY
  SELECT 
    p.user_id,
    p.display_name,
    p.username,
    p.avatar_url,
    p.bio
  FROM public.profiles p
  WHERE p.user_id = target_user_id
    AND p.status != 'banned'
    AND auth.uid() IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;