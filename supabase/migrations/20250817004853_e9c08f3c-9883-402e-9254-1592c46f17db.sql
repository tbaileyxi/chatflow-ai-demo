-- Add onboarding_completed flag to profiles to control onboarding flow
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;