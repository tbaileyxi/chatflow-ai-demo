-- Add columns to huddles table for official team huddles and side huddles
ALTER TABLE public.huddles 
ADD COLUMN IF NOT EXISTS is_official_team_huddle BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS parent_team_id UUID REFERENCES public.teams(id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_huddles_official_team ON public.huddles(team_id, is_official_team_huddle) WHERE is_official_team_huddle = true;
CREATE INDEX IF NOT EXISTS idx_huddles_parent_team ON public.huddles(parent_team_id) WHERE parent_team_id IS NOT NULL;

-- Create official public huddles for each team
INSERT INTO public.huddles (
  name,
  team_id,
  owner_id,
  is_private,
  is_official_team_huddle,
  bio,
  member_count
)
SELECT 
  CONCAT(t.city, ' ', t.name, ' Community') as name,
  t.id as team_id,
  (SELECT get_or_create_system_user()) as owner_id,
  false as is_private,
  true as is_official_team_huddle,
  CONCAT('Welcome to the official ', t.city, ' ', t.name, ' community! Connect with fellow fans, share your thoughts, and stay updated. Hit the button above to create your own private Side Huddle!') as bio,
  0 as member_count
FROM public.teams t
WHERE NOT EXISTS (
  SELECT 1 FROM public.huddles h 
  WHERE h.team_id = t.id 
  AND h.is_official_team_huddle = true
);

-- Create function to auto-join official team huddles when users follow teams
CREATE OR REPLACE FUNCTION public.auto_join_official_team_huddle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  official_huddle_id UUID;
  already_member BOOLEAN;
BEGIN
  -- Get the official huddle for this team
  SELECT id INTO official_huddle_id
  FROM public.huddles
  WHERE team_id = NEW.team_id
  AND is_official_team_huddle = true
  LIMIT 1;
  
  -- If official huddle exists, add user as member
  IF official_huddle_id IS NOT NULL THEN
    -- Check if already a member
    SELECT EXISTS (
      SELECT 1 FROM public.huddle_members
      WHERE huddle_id = official_huddle_id AND user_id = NEW.user_id
    ) INTO already_member;
    
    -- Add as member if not already
    IF NOT already_member THEN
      INSERT INTO public.huddle_members (huddle_id, user_id)
      VALUES (official_huddle_id, NEW.user_id);
      
      -- Update member count
      UPDATE public.huddles
      SET member_count = member_count + 1,
          last_message_at = now()
      WHERE id = official_huddle_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on user_follows to auto-join official huddles
DROP TRIGGER IF EXISTS on_team_follow_join_huddle ON public.user_follows;
CREATE TRIGGER on_team_follow_join_huddle
AFTER INSERT ON public.user_follows
FOR EACH ROW
EXECUTE FUNCTION public.auto_join_official_team_huddle();

-- Update RLS policies for official huddles
DROP POLICY IF EXISTS "Anyone can view official team huddles" ON public.huddles;
CREATE POLICY "Anyone can view official team huddles"
ON public.huddles
FOR SELECT
TO authenticated
USING (is_official_team_huddle = true);

-- Allow users to create side huddles (but not official ones)
DROP POLICY IF EXISTS "Users can create huddles" ON public.huddles;
CREATE POLICY "Users can create huddles"
ON public.huddles
FOR INSERT
TO authenticated
WITH CHECK (
  owner_id = auth.uid() 
  AND is_official_team_huddle = false
  AND NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND status = 'banned'
  )
);