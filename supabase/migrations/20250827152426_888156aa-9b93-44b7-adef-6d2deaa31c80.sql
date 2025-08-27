-- Enhanced security for huddle_subscriptions table
-- Add additional policy to ensure user owns both the subscription AND the huddle

-- Drop existing policies to replace with more secure ones
DROP POLICY IF EXISTS "Owners can view their subscriptions" ON public.huddle_subscriptions;
DROP POLICY IF EXISTS "Owners can insert their subscriptions" ON public.huddle_subscriptions;  
DROP POLICY IF EXISTS "Owners can update their subscriptions" ON public.huddle_subscriptions;

-- Create enhanced policies with additional huddle ownership validation
CREATE POLICY "Enhanced owner subscription access" ON public.huddle_subscriptions
FOR ALL
USING (
  auth.uid() = owner_id 
  AND EXISTS (
    SELECT 1 FROM public.huddles 
    WHERE huddles.id = huddle_subscriptions.huddle_id 
    AND huddles.owner_id = auth.uid()
  )
)
WITH CHECK (
  auth.uid() = owner_id 
  AND EXISTS (
    SELECT 1 FROM public.huddles 
    WHERE huddles.id = huddle_subscriptions.huddle_id 
    AND huddles.owner_id = auth.uid()
  )
);

-- Create a secure function to get subscription status without exposing sensitive payment data
CREATE OR REPLACE FUNCTION public.get_huddle_subscription_status(target_huddle_id uuid)
RETURNS TABLE(
  is_verified boolean,
  expires_at timestamptz,
  status text
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only return subscription status if user owns the huddle
  IF NOT EXISTS (
    SELECT 1 FROM public.huddles 
    WHERE id = target_huddle_id 
    AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: You do not own this huddle';
  END IF;

  -- Return only non-sensitive subscription information
  RETURN QUERY
  SELECT 
    hs.status = 'active' AND hs.expires_at > now() as is_verified,
    hs.expires_at,
    hs.status
  FROM public.huddle_subscriptions hs
  WHERE hs.huddle_id = target_huddle_id
    AND hs.owner_id = auth.uid()
    AND hs.status = 'active'
  LIMIT 1;
  
  -- If no active subscription found, return default values
  IF NOT FOUND THEN
    RETURN QUERY SELECT false::boolean, null::timestamptz, 'inactive'::text;
  END IF;
END;
$$;

-- Add audit trigger for subscription access (optional security enhancement)
CREATE TABLE IF NOT EXISTS public.subscription_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  huddle_id uuid NOT NULL,
  action text NOT NULL,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.subscription_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view subscription audit logs" ON public.subscription_audit_log
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Allow system to insert audit logs
CREATE POLICY "System can insert audit logs" ON public.subscription_audit_log
FOR INSERT
WITH CHECK (true);