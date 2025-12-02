-- Add reply_to_id column for threaded replies (one level deep)
ALTER TABLE public.huddle_messages 
ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.huddle_messages(id);

-- Create index for efficient reply queries
CREATE INDEX IF NOT EXISTS idx_huddle_messages_reply_to ON public.huddle_messages(reply_to_id);

-- Create trigger function to auto-join team's public huddle when user follows a team
CREATE OR REPLACE FUNCTION public.auto_join_team_public_huddle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  public_huddle_id UUID;
BEGIN
  -- Find the public huddle for this team
  SELECT id INTO public_huddle_id
  FROM public.huddles
  WHERE team_id = NEW.team_id 
    AND is_official_team_huddle = true
  LIMIT 1;
  
  -- If public huddle exists, add user as member
  IF public_huddle_id IS NOT NULL THEN
    INSERT INTO public.huddle_members (huddle_id, user_id)
    VALUES (public_huddle_id, NEW.user_id)
    ON CONFLICT (huddle_id, user_id) DO NOTHING;
    
    -- Update member count
    UPDATE public.huddles
    SET member_count = member_count + 1,
        last_message_at = now()
    WHERE id = public_huddle_id
      AND NOT EXISTS (
        SELECT 1 FROM public.huddle_members 
        WHERE huddle_id = public_huddle_id AND user_id = NEW.user_id
      );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on user_follows table
DROP TRIGGER IF EXISTS on_team_follow_auto_join_huddle ON public.user_follows;
CREATE TRIGGER on_team_follow_auto_join_huddle
  AFTER INSERT ON public.user_follows
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_join_team_public_huddle();