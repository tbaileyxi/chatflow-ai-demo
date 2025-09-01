-- Create huddle_pickem_settings table for season-long Pick 'Em configuration
CREATE TABLE public.huddle_pickem_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  huddle_id UUID NOT NULL REFERENCES public.huddles(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  league TEXT NOT NULL DEFAULT 'ncaa',
  auto_create_weekly BOOLEAN NOT NULL DEFAULT false,
  max_games INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(huddle_id)
);

-- Enable RLS
ALTER TABLE public.huddle_pickem_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Huddle owners can manage pick'em settings"
ON public.huddle_pickem_settings
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.huddles 
  WHERE huddles.id = huddle_pickem_settings.huddle_id 
  AND huddles.owner_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.huddles 
  WHERE huddles.id = huddle_pickem_settings.huddle_id 
  AND huddles.owner_id = auth.uid()
));

-- Members can view settings for huddles they're in
CREATE POLICY "Members can view pick'em settings"
ON public.huddle_pickem_settings
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.huddle_members hm
  WHERE hm.huddle_id = huddle_pickem_settings.huddle_id
  AND hm.user_id = auth.uid()
));

-- Add updated_at trigger
CREATE TRIGGER update_huddle_pickem_settings_updated_at
BEFORE UPDATE ON public.huddle_pickem_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();