
-- Recreate the trigger to auto-join users to Everywhere Huddle when they complete onboarding

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS on_profile_completed ON public.profiles;
DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;

-- Create trigger when user completes onboarding (updates onboarding_completed to true)
CREATE TRIGGER on_profile_completed
  AFTER UPDATE OF onboarding_completed ON public.profiles
  FOR EACH ROW
  WHEN (NEW.onboarding_completed = true AND OLD.onboarding_completed = false)
  EXECUTE FUNCTION auto_join_everywhere_huddle();

-- Create trigger when new profile is created with onboarding already completed
CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  WHEN (NEW.onboarding_completed = true)
  EXECUTE FUNCTION auto_join_everywhere_huddle();
