-- Add content_admin to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'content_admin';

-- Create a table to track content admin team assignments
CREATE TABLE IF NOT EXISTS public.content_admin_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    team_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID NOT NULL,
    UNIQUE (user_id, team_id)
);

-- Enable RLS on content_admin_teams
ALTER TABLE public.content_admin_teams ENABLE ROW LEVEL SECURITY;

-- Admins can manage content admin team assignments
CREATE POLICY "Admins can manage content admin teams"
ON public.content_admin_teams
FOR ALL
TO authenticated
USING (
    public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
    public.has_role(auth.uid(), 'admin')
);

-- Content admins can view their own team assignments
CREATE POLICY "Content admins can view their teams"
ON public.content_admin_teams
FOR SELECT
TO authenticated
USING (user_id = auth.uid());