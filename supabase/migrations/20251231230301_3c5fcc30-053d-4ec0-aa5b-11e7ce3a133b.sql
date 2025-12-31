-- Create live_events table for admin-managed live events
CREATE TABLE public.live_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  subtitle TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  network TEXT,
  team1_id UUID REFERENCES public.teams(id),
  team2_id UUID REFERENCES public.teams(id),
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'completed')),
  is_pinned BOOLEAN DEFAULT true,
  score_team1 INTEGER,
  score_team2 INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

-- Enable RLS
ALTER TABLE public.live_events ENABLE ROW LEVEL SECURITY;

-- Public can view live events
CREATE POLICY "Anyone can view live events"
ON public.live_events
FOR SELECT
USING (true);

-- Admins can manage live events
CREATE POLICY "Admins can manage live events"
ON public.live_events
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_live_events_updated_at
BEFORE UPDATE ON public.live_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();