-- Fix team_waitlist table security issue
-- Remove overly permissive policies and ensure only proper access

-- First, drop existing policies to rebuild them securely
DROP POLICY IF EXISTS "Admins can view all waitlist entries" ON public.team_waitlist;
DROP POLICY IF EXISTS "Authenticated users can join waitlists" ON public.team_waitlist;
DROP POLICY IF EXISTS "Users can view their own waitlist team only" ON public.team_waitlist;

-- Create more secure policies that protect email addresses

-- 1. Only admins can view all waitlist entries (including emails)
CREATE POLICY "Admins can view all waitlist entries" 
ON public.team_waitlist 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'::app_role
  )
);

-- 2. Only authenticated users can add themselves to waitlists
CREATE POLICY "Users can join waitlists" 
ON public.team_waitlist 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND auth.uid() = user_id
);

-- 3. Users can only see their own waitlist entries (without other users' emails)
CREATE POLICY "Users can view their own waitlist entries" 
ON public.team_waitlist 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND auth.uid() = user_id
);

-- 4. Prevent any updates or deletes to maintain data integrity
-- No UPDATE or DELETE policies means these operations are blocked for non-superusers