-- Fix email confirmation flow by updating the auth trigger to handle pending huddle joins
-- and enable real-time for huddle_messages table

-- Enable real-time for huddle_messages
ALTER TABLE public.huddle_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.huddle_messages;

-- Create a function to handle post-confirmation huddle joining
CREATE OR REPLACE FUNCTION public.handle_post_auth_huddle_join()
RETURNS trigger
LANGUAGE plpgsql
SECURITY definer 
SET search_path = ''
AS $$
DECLARE
  pending_join_data jsonb;
BEGIN
  -- Check if user has pending huddle join data in their user metadata
  pending_join_data := NEW.raw_user_meta_data -> 'pendingHuddleJoin';
  
  IF pending_join_data IS NOT NULL THEN
    -- Insert user into huddle_members if they're not already there
    INSERT INTO public.huddle_members (huddle_id, user_id)
    VALUES (
      (pending_join_data ->> 'huddleId')::uuid,
      NEW.id
    )
    ON CONFLICT (huddle_id, user_id) DO NOTHING;
    
    -- Update huddle member count
    UPDATE public.huddles 
    SET member_count = member_count + 1,
        last_message_at = now()
    WHERE id = (pending_join_data ->> 'huddleId')::uuid
      AND NOT EXISTS (
        SELECT 1 FROM public.huddle_members 
        WHERE huddle_id = (pending_join_data ->> 'huddleId')::uuid 
        AND user_id = NEW.id
      );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update the existing trigger to also handle huddle joins
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER on_auth_user_confirmed  
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW 
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.handle_post_auth_huddle_join();