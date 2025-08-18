-- Ensure huddle owners are automatically added as members when creating a huddle
CREATE OR REPLACE FUNCTION public.add_huddle_owner_as_member()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert the owner as a member of the huddle they just created
  INSERT INTO public.huddle_members (huddle_id, user_id)
  VALUES (NEW.id, NEW.owner_id)
  ON CONFLICT (huddle_id, user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;