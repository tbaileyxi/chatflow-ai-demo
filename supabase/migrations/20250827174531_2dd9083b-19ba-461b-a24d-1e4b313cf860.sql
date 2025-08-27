-- Create function to insert welcome message for new huddles
CREATE OR REPLACE FUNCTION public.insert_huddle_welcome_message()
RETURNS TRIGGER AS $$
DECLARE
  system_user_id UUID;
  welcome_message TEXT;
BEGIN
  -- Get or create system user
  system_user_id := get_or_create_system_user();
  
  -- Define the welcome message
  welcome_message := 'Welcome to your Side Huddle. This is your private agent enhanced chat.

What''s that mean? Your side huddle is Invite only. Invite your friends and family with the link above. Your private chat will populate with your team curated social news, polls, score updates and more - throughout the season and in game.

Your sports group thread with your college buddies lives here.

Did you catch an insane video at the game? Want to share your posts to the larger world? Just double click the post and hit the megaphone to put your post on the spotlight feed.';

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

-- Create trigger to automatically send welcome message when huddle is created
CREATE TRIGGER insert_huddle_welcome_message_trigger
  AFTER INSERT ON public.huddles
  FOR EACH ROW
  EXECUTE FUNCTION public.insert_huddle_welcome_message();