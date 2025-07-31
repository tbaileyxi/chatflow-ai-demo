-- Fix RLS policies for user_roles table to prevent access issues

-- First, ensure the get_current_user_role function exists and works properly
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1
$function$;

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

-- Create new simplified policies
CREATE POLICY "Users can view their own roles" 
ON public.user_roles 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles" 
ON public.user_roles 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert roles" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update roles" 
ON public.user_roles 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete roles" 
ON public.user_roles 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow first admin setup (when no admin exists)
CREATE POLICY "Allow first admin setup" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (
  role = 'admin'::app_role 
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role = 'admin'::app_role
  )
);