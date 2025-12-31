-- Phase 1: Database Schema Changes for Side Huddle Final Build

-- 1.1 Change huddles.is_private default to FALSE (all huddles PUBLIC by default)
ALTER TABLE public.huddles ALTER COLUMN is_private SET DEFAULT false;

-- 1.2 Create boosts table for $1-$5 boosts on messages
CREATE TABLE public.boosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.huddle_messages(id) ON DELETE CASCADE,
  booster_id UUID NOT NULL,
  amount INTEGER NOT NULL CHECK (amount IN (1, 2, 3, 5)),
  stripe_payment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX idx_boosts_message_id ON public.boosts(message_id);
CREATE INDEX idx_boosts_booster_id ON public.boosts(booster_id);

-- Enable RLS
ALTER TABLE public.boosts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for boosts
CREATE POLICY "Users can view boosts in huddles they're members of"
ON public.boosts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM huddle_messages hm
    JOIN huddle_members hmbr ON hmbr.huddle_id = hm.huddle_id
    WHERE hm.id = boosts.message_id AND hmbr.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM huddle_messages hm
    JOIN huddles h ON h.id = hm.huddle_id
    WHERE hm.id = boosts.message_id AND (h.is_private = false OR h.is_official_team_huddle = true)
  )
);

CREATE POLICY "Users can create boosts"
ON public.boosts FOR INSERT
WITH CHECK (auth.uid() = booster_id);

-- 1.3 Add pulse moment columns to huddle_messages
ALTER TABLE public.huddle_messages 
ADD COLUMN IF NOT EXISTS is_pulse_moment BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS pulse_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pulse_source TEXT,
ADD COLUMN IF NOT EXISTS boost_amount INTEGER DEFAULT 0;

-- Create index for pulse moments
CREATE INDEX idx_huddle_messages_pulse ON public.huddle_messages(huddle_id, is_pulse_moment) 
WHERE is_pulse_moment = true;

-- 1.4 Add last_seen_at to huddle_members for returning user experience
ALTER TABLE public.huddle_members
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT now();

-- Create function to update boost_amount on message when boost is created
CREATE OR REPLACE FUNCTION public.update_message_boost_amount()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.huddle_messages
  SET boost_amount = COALESCE(boost_amount, 0) + NEW.amount
  WHERE id = NEW.message_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for boost amount updates
CREATE TRIGGER on_boost_created
AFTER INSERT ON public.boosts
FOR EACH ROW
EXECUTE FUNCTION public.update_message_boost_amount();