-- Fix team_waitlist security issues
-- Drop existing policies that are too permissive
DROP POLICY IF EXISTS "Users can join waitlists anonymously" ON public.team_waitlist;
DROP POLICY IF EXISTS "Users can view their own waitlist entries" ON public.team_waitlist;

-- Create more secure policies
-- Only authenticated users can join waitlists
CREATE POLICY "Authenticated users can join waitlists" 
ON public.team_waitlist 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- Users can only view the team_id of their own waitlist entries (no email exposure)
CREATE POLICY "Users can view their own waitlist team only" 
ON public.team_waitlist 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);