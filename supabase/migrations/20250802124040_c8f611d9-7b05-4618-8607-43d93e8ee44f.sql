-- Add status column to teams table for waitlist functionality
ALTER TABLE public.teams ADD COLUMN status text DEFAULT 'active' CHECK (status IN ('active', 'coming_soon', 'inactive'));

-- Create team_waitlist table for capturing user emails for team launch notifications
CREATE TABLE public.team_waitlist (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid NOT NULL,
  user_id uuid,
  email text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on team_waitlist
ALTER TABLE public.team_waitlist ENABLE ROW LEVEL SECURITY;

-- Create policies for team_waitlist
CREATE POLICY "Users can join waitlists" 
ON public.team_waitlist 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can view their own waitlist entries" 
ON public.team_waitlist 
FOR SELECT 
USING (user_id = auth.uid() OR auth.uid() IS NULL);

CREATE POLICY "Admins can view all waitlist entries" 
ON public.team_waitlist 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM user_roles 
  WHERE user_id = auth.uid() AND role = 'admin'::app_role
));

-- Add index for better performance
CREATE INDEX idx_team_waitlist_team_id ON public.team_waitlist(team_id);
CREATE INDEX idx_team_waitlist_user_id ON public.team_waitlist(user_id);

-- Update some existing teams to coming_soon status for demo (using subquery instead of LIMIT)
UPDATE public.teams SET status = 'coming_soon' 
WHERE id IN (
  SELECT id FROM public.teams 
  WHERE league = 'NCAA' AND name ILIKE '%Wildcats%' 
  ORDER BY name 
  LIMIT 3
);