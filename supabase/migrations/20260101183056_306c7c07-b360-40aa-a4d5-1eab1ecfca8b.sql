-- Add event_id column to huddles table for linking to live_events
ALTER TABLE public.huddles
ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.live_events(id);

-- Create unique index so each event can only have one huddle
CREATE UNIQUE INDEX IF NOT EXISTS huddles_event_id_unique
ON public.huddles(event_id)
WHERE event_id IS NOT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.huddles.event_id IS 'Links this huddle to a specific live event';