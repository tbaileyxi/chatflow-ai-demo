-- Drop trigger first, then recreate function
DROP TRIGGER IF EXISTS update_verification_status ON public.huddle_subscriptions;
DROP FUNCTION IF EXISTS update_huddle_verification();
DROP FUNCTION IF EXISTS approve_huddle_join_request(UUID);

-- Recreate functions with proper search path
CREATE OR REPLACE FUNCTION update_huddle_verification()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.status = 'active' AND NEW.expires_at > now() THEN
    UPDATE public.huddles 
    SET is_verified = true, verification_expires_at = NEW.expires_at
    WHERE id = NEW.huddle_id;
  ELSE
    UPDATE public.huddles 
    SET is_verified = false, verification_expires_at = null
    WHERE id = NEW.huddle_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION approve_huddle_join_request(request_id UUID)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  req_record RECORD;
BEGIN
  -- Get the request details
  SELECT * INTO req_record FROM public.huddle_join_requests WHERE id = request_id;
  
  IF req_record IS NULL THEN
    RAISE EXCEPTION 'Join request not found';
  END IF;
  
  -- Update request status
  UPDATE public.huddle_join_requests 
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = request_id;
  
  -- Add user to huddle members
  INSERT INTO public.huddle_members (huddle_id, user_id)
  VALUES (req_record.huddle_id, req_record.user_id)
  ON CONFLICT (huddle_id, user_id) DO NOTHING;
  
  -- Update huddle member count
  UPDATE public.huddles 
  SET member_count = member_count + 1, last_message_at = now()
  WHERE id = req_record.huddle_id;
END;
$$;

-- Recreate trigger
CREATE TRIGGER update_verification_status
  AFTER INSERT OR UPDATE ON public.huddle_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_huddle_verification();