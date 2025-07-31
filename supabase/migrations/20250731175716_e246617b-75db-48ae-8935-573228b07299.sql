-- Fix huddle access for invitation links (allow public access to huddles being joined)
CREATE POLICY "Anyone can view huddles for joining via invite links"
ON public.huddles
FOR SELECT
USING (true);

-- Also ensure profile creation doesn't fail - check if we have the handle_new_user trigger
-- and update it to be more robust
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY definer 
SET search_path = ''
AS $$
BEGIN
  -- Insert profile with email-based username if no profile exists
  INSERT INTO public.profiles (user_id, display_name, username)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', 'User'),
    COALESCE(NEW.raw_user_meta_data ->> 'username', SPLIT_PART(NEW.email, '@', 1) || '_' || SUBSTRING(NEW.id::text FROM 1 FOR 8))
  )
  ON CONFLICT (user_id) DO NOTHING; -- Prevent duplicate key errors
  
  RETURN NEW;
END;
$$;