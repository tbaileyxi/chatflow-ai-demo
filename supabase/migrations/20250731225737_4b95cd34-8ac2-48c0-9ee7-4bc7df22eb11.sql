-- Add user status management columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN status text DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'banned')),
ADD COLUMN blocked_at timestamp with time zone,
ADD COLUMN banned_at timestamp with time zone,
ADD COLUMN banned_reason text,
ADD COLUMN last_login_at timestamp with time zone,
ADD COLUMN signup_method text DEFAULT 'phone';

-- Update the handle_new_user function to properly extract phone number
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Insert profile with phone number extracted from auth metadata
  INSERT INTO public.profiles (
    user_id, 
    display_name, 
    username, 
    phone_number,
    signup_method,
    last_login_at
  )
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', 'User'),
    COALESCE(NEW.raw_user_meta_data ->> 'username', SPLIT_PART(COALESCE(NEW.email, NEW.phone), '@', 1) || '_' || SUBSTRING(NEW.id::text FROM 1 FOR 8)),
    COALESCE(NEW.phone, NEW.raw_user_meta_data ->> 'phone_number'),
    CASE WHEN NEW.phone IS NOT NULL THEN 'phone' ELSE 'email' END,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    phone_number = EXCLUDED.phone_number,
    last_login_at = EXCLUDED.last_login_at;
  
  RETURN NEW;
END;
$$;

-- Create function to update last login
CREATE OR REPLACE FUNCTION public.update_last_login()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.profiles 
  SET last_login_at = now()
  WHERE user_id = NEW.id;
  
  RETURN NEW;
END;
$$;

-- Create trigger to update last login on auth events
DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users;
CREATE TRIGGER on_auth_user_login
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW 
  WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
  EXECUTE FUNCTION public.update_last_login();

-- Update RLS policies to block banned/blocked users
CREATE POLICY "Banned users cannot access data" ON public.profiles
FOR ALL USING (
  CASE 
    WHEN auth.uid() IS NULL THEN false
    WHEN auth.uid() = user_id THEN status != 'banned'
    ELSE true
  END
);

-- Update posts policies to block banned users
ALTER POLICY "Posts are viewable by everyone" ON public.posts 
USING (
  NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND status = 'banned'
  )
);

-- Update huddles policies to block banned users  
ALTER POLICY "Users can create huddles" ON public.huddles
WITH CHECK (
  owner_id = auth.uid() AND 
  NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND status = 'banned'
  )
);