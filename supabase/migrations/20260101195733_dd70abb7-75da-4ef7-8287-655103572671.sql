-- Create pulse_runs table for rate limiting and budget control
CREATE TABLE public.pulse_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  huddle_id uuid NOT NULL REFERENCES public.huddles(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.live_events(id) ON DELETE SET NULL,
  ran_at timestamp with time zone NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'auto',
  items_inserted integer NOT NULL DEFAULT 0,
  items_found integer NOT NULL DEFAULT 0,
  queries_used text[] DEFAULT '{}'
);

-- Enable RLS
ALTER TABLE public.pulse_runs ENABLE ROW LEVEL SECURITY;

-- Allow admins to read all pulse_runs
CREATE POLICY "Admins can read pulse_runs"
ON public.pulse_runs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Allow service role to insert (edge functions)
CREATE POLICY "Service role can insert pulse_runs"
ON public.pulse_runs
FOR INSERT
WITH CHECK (true);

-- Create index for rate limiting queries
CREATE INDEX idx_pulse_runs_huddle_ran_at 
ON public.pulse_runs(huddle_id, ran_at DESC);

CREATE INDEX idx_pulse_runs_event_ran_at 
ON public.pulse_runs(event_id, ran_at DESC);