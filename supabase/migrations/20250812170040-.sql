-- Fix security vulnerability in profiles table
-- Remove the overly permissive policy that allows public access to personal data

-- Drop the current problematic policy that allows anyone to view all profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create a new, secure policy that restricts profile visibility
CREATE POLICY "Authenticated users can view profiles" 
ON public.profiles 
FOR SELECT 
USING (
  -- Only allow if user is authenticated
  auth.uid() IS NOT NULL
);

-- Also ensure the existing policies are still secure
-- Keep "Users can insert their own profile" (already secure)
-- Keep "Users can update their own profile" (already secure) 
-- Keep "Banned users cannot access data" (already handles banned users)