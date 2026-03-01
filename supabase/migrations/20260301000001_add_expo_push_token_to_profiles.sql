-- Add expo_push_token column to profiles for push notification delivery
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS expo_push_token TEXT;

-- Index for efficient lookup when sending push notifications
CREATE INDEX IF NOT EXISTS idx_profiles_expo_push_token
ON public.profiles(expo_push_token)
WHERE expo_push_token IS NOT NULL;
