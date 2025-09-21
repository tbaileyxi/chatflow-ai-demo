-- Enable RLS on all three views
ALTER VIEW public.pickem_leaderboard ENABLE ROW LEVEL SECURITY;
ALTER VIEW public.pickem_season_leaderboard ENABLE ROW LEVEL SECURITY;
ALTER VIEW public.pickem_user_totals ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for pickem_leaderboard view
CREATE POLICY "Members can view leaderboard for their huddle instances" 
ON public.pickem_leaderboard 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM pickem_instances i
    JOIN huddle_members hm ON hm.huddle_id = i.huddle_id
    WHERE i.id = instance_id 
    AND hm.user_id = auth.uid()
  )
);

-- Create RLS policies for pickem_season_leaderboard view
CREATE POLICY "Users can view season leaderboard if authenticated" 
ON public.pickem_season_leaderboard 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Create RLS policies for pickem_user_totals view  
CREATE POLICY "Users can view user totals if authenticated" 
ON public.pickem_user_totals 
FOR SELECT 
USING (auth.uid() IS NOT NULL);