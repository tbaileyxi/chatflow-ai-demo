-- Fix security vulnerability in team_waitlist table
-- Remove the overly permissive policy that allows unauthenticated access to emails

-- Drop the current problematic policy
DROP POLICY IF EXISTS "Users can view their own waitlist entries" ON public.team_waitlist;

-- Create a new, secure policy that only allows authenticated users to view their own entries
CREATE POLICY "Users can view their own waitlist entries" 
ON public.team_waitlist 
FOR SELECT 
USING (
  -- Only allow if user is authenticated AND it's their own entry
  (auth.uid() IS NOT NULL AND user_id = auth.uid())
);

-- Keep existing policies:
-- "Admins can view all waitlist entries" - admins can still see all
-- "Users can join waitlists" - users can still join