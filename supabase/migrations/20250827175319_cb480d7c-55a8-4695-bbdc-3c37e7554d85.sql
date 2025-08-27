-- Update the welcome message function with new copy
CREATE OR REPLACE FUNCTION public.insert_huddle_welcome_message()
RETURNS TRIGGER AS $$
DECLARE
  system_user_id UUID;
  welcome_message TEXT;
BEGIN
  -- Get or create system user
  system_user_id := get_or_create_system_user();
  
  -- Define the welcome message
  welcome_message := 'Welcome to your Side Huddle—your private, AI-powered sports chat! It''s Invite only, so Invite your crew with the  link above. 
Get curated news, polls, live scores, and more, all season long, plus in-game scores and happenings.  

Say whatever you like.  It''s your thread.  

Your college squad''s game-day thread thrives here. 

Caught an epic moment? Double-tap and hit the megaphone to share it with the world!';

  -- Insert welcome message
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