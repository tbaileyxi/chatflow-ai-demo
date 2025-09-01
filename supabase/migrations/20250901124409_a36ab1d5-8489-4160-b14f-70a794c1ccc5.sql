-- Fix search path security warning for the member count function
CREATE OR REPLACE FUNCTION update_huddle_member_count() 
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE huddles 
    SET member_count = (
      SELECT COUNT(*) 
      FROM huddle_members 
      WHERE huddle_id = NEW.huddle_id
    ), last_message_at = now()
    WHERE id = NEW.huddle_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE huddles 
    SET member_count = (
      SELECT COUNT(*) 
      FROM huddle_members 
      WHERE huddle_id = OLD.huddle_id
    ), last_message_at = now()
    WHERE id = OLD.huddle_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;