-- Fix the trigger creation properly
DROP TRIGGER IF EXISTS trigger_add_huddle_owner_as_member ON public.huddles CASCADE;
DROP FUNCTION IF EXISTS public.add_huddle_owner_as_member() CASCADE;

-- Create the function with proper search path
CREATE OR REPLACE FUNCTION public.add_huddle_owner_as_member()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Insert the owner as a member of the huddle they just created
  INSERT INTO public.huddle_members (huddle_id, user_id)
  VALUES (NEW.id, NEW.owner_id)
  ON CONFLICT (huddle_id, user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER trigger_add_huddle_owner_as_member
  AFTER INSERT ON public.huddles
  FOR EACH ROW
  EXECUTE FUNCTION public.add_huddle_owner_as_member();