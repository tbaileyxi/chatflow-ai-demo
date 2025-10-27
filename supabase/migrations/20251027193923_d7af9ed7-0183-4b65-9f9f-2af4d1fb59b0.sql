-- Fix Issue #2: Re-enable Everywhere Huddle auto-join triggers
ALTER TABLE public.profiles ENABLE TRIGGER on_profile_completed;
ALTER TABLE public.profiles ENABLE TRIGGER on_profile_created;

-- Fix Issue #4: Create missing profile for tbaileyxi+101@gmail.com
INSERT INTO public.profiles (
  user_id,
  display_name,
  username,
  phone_number,
  status,
  onboarding_completed
) VALUES (
  'e3684c07-7a7c-4771-82f2-4cd72a4752e8',
  'Content Editor 101',
  'content_editor_101',
  'tbaileyxi+101@gmail.com',
  'active',
  true
)
ON CONFLICT (user_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  status = EXCLUDED.status,
  onboarding_completed = EXCLUDED.onboarding_completed;

-- Grant content_admin role to the user
INSERT INTO public.user_roles (user_id, role)
VALUES ('e3684c07-7a7c-4771-82f2-4cd72a4752e8', 'content_admin')
ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;