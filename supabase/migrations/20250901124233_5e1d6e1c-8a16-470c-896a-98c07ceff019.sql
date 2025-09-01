-- Add trigger to automatically update member count when members are added/removed
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
$$ LANGUAGE plpgsql;

-- Create trigger for member count updates
DROP TRIGGER IF EXISTS update_member_count_trigger ON huddle_members;
CREATE TRIGGER update_member_count_trigger
  AFTER INSERT OR DELETE ON huddle_members
  FOR EACH ROW EXECUTE FUNCTION update_huddle_member_count();

-- Add RLS policy for admins to remove huddle members
CREATE POLICY "Admins can remove huddle members" ON huddle_members
FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM user_roles 
  WHERE user_id = auth.uid() AND role = 'admin'::app_role
));

-- Add RLS policy for owners to remove huddle members  
CREATE POLICY "Owners can remove huddle members" ON huddle_members
FOR DELETE TO authenticated  
USING (EXISTS (
  SELECT 1 FROM huddles 
  WHERE id = huddle_members.huddle_id AND owner_id = auth.uid()
));