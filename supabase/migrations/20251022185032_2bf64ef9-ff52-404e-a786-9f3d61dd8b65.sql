-- Update welcome message for Side Huddles
CREATE OR REPLACE FUNCTION public.insert_huddle_welcome_message()
RETURNS TRIGGER AS $$
DECLARE
  system_user_id UUID;
  welcome_message TEXT;
BEGIN
  system_user_id := get_or_create_system_user();
  
  welcome_message := '🏟️ Welcome to your Side Huddle—your private, AI-powered sports chat!
🔒 Invite-only: Bring your crew with the link above!
📰 Stay updated with your team''s social news, curated updates, polls, and live scores all season.
🤖 Just chat @Coach for the latest team info.
🗣️ Your space, your voice—share your thoughts freely!
📣 Epic moment? Double-tap and hit the megaphone to share with the world!';

  INSERT INTO public.huddle_messages (
    huddle_id,
    user_id,
    content,
    is_bot_message
  ) VALUES (
    NEW.id,
    system_user_id,
    welcome_message,
    true
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or ensure Everywhere Huddle exists
INSERT INTO public.huddles (
  name,
  owner_id,
  team_id,
  is_private,
  member_count
) 
SELECT 
  'Everywhere Huddle',
  'd844fb6c-fa42-4c58-b8d4-477a0cb1d705'::uuid,
  '5307506a-e4a5-4ed9-b0e8-4eff6ef57b53'::uuid,
  false,
  1
WHERE NOT EXISTS (
  SELECT 1 FROM public.huddles 
  WHERE team_id = '5307506a-e4a5-4ed9-b0e8-4eff6ef57b53'::uuid 
    AND owner_id = 'd844fb6c-fa42-4c58-b8d4-477a0cb1d705'::uuid
);

-- Create function to auto-join users to Everywhere Huddle
CREATE OR REPLACE FUNCTION public.auto_join_everywhere_huddle()
RETURNS TRIGGER AS $$
DECLARE
  everywhere_huddle_id UUID;
  already_member BOOLEAN;
BEGIN
  -- Get the Everywhere Huddle ID
  SELECT id INTO everywhere_huddle_id 
  FROM public.huddles 
  WHERE team_id = '5307506a-e4a5-4ed9-b0e8-4eff6ef57b53'::uuid 
    AND owner_id = 'd844fb6c-fa42-4c58-b8d4-477a0cb1d705'::uuid
  LIMIT 1;
  
  -- Only proceed if Everywhere Huddle exists
  IF everywhere_huddle_id IS NOT NULL THEN
    -- Check if user is already a member
    SELECT EXISTS (
      SELECT 1 FROM public.huddle_members 
      WHERE huddle_id = everywhere_huddle_id AND user_id = NEW.user_id
    ) INTO already_member;
    
    -- Add user as member if not already joined
    IF NOT already_member THEN
      INSERT INTO public.huddle_members (huddle_id, user_id, joined_at)
      VALUES (everywhere_huddle_id, NEW.user_id, NOW())
      ON CONFLICT (huddle_id, user_id) DO NOTHING;
      
      -- Increment member count
      UPDATE public.huddles 
      SET member_count = member_count + 1,
          last_message_at = NOW()
      WHERE id = everywhere_huddle_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger when user completes onboarding
DROP TRIGGER IF EXISTS on_profile_completed ON public.profiles;
CREATE TRIGGER on_profile_completed
  AFTER UPDATE OF onboarding_completed ON public.profiles
  FOR EACH ROW
  WHEN (NEW.onboarding_completed = true AND OLD.onboarding_completed = false)
  EXECUTE FUNCTION auto_join_everywhere_huddle();

-- Also trigger on new profile creation (for existing users)
DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  WHEN (NEW.onboarding_completed = true)
  EXECUTE FUNCTION auto_join_everywhere_huddle();