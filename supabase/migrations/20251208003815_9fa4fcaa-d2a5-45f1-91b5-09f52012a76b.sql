-- Fix RLS policy on huddle_pricing to allow anonymous users to see pricing for verified public huddles
-- Drop the existing restrictive policy and recreate as permissive
DROP POLICY IF EXISTS "Anyone can view pricing for verified public huddles" ON huddle_pricing;

CREATE POLICY "Anyone can view pricing for verified public huddles" 
ON huddle_pricing 
FOR SELECT 
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM huddles
    WHERE huddles.id = huddle_pricing.huddle_id 
    AND huddles.is_verified = true 
    AND huddles.is_private = false
  )
);