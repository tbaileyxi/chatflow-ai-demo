-- Create user_badges table for team badge purchases
CREATE TABLE public.user_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('basic', 'superfan')),
  is_active BOOLEAN NOT NULL DEFAULT false,
  purchased_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  stripe_payment_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- Create index for fast lookups
CREATE INDEX idx_user_badges_user_id ON public.user_badges(user_id);
CREATE INDEX idx_user_badges_team_id ON public.user_badges(team_id);
CREATE UNIQUE INDEX idx_user_badges_user_team_tier ON public.user_badges(user_id, team_id, tier);

-- RLS Policies
-- Anyone can see badges (for displaying next to names)
CREATE POLICY "Badges are viewable by everyone" 
ON public.user_badges 
FOR SELECT 
USING (true);

-- Users can only insert their own badges (via Stripe webhook)
CREATE POLICY "Users can insert their own badges" 
ON public.user_badges 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can update their own badges (set active)
CREATE POLICY "Users can update their own badges" 
ON public.user_badges 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Function to get user's active badge for display
CREATE OR REPLACE FUNCTION public.get_user_active_badge(target_user_id uuid)
RETURNS TABLE(team_id uuid, tier text, team_name text, team_logo_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ub.team_id,
    ub.tier,
    t.name AS team_name,
    t.logo_url AS team_logo_url
  FROM user_badges ub
  JOIN teams t ON t.id = ub.team_id
  WHERE ub.user_id = target_user_id
    AND ub.is_active = true
  LIMIT 1;
END;
$$;