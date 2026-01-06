-- Create table to store cursor state for pulse-scheduler batching
CREATE TABLE IF NOT EXISTS public.pulse_scheduler_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cursor_index INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert single row for tracking
INSERT INTO public.pulse_scheduler_state (id, cursor_index)
VALUES ('00000000-0000-0000-0000-000000000001', 0)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS but allow only service_role (edge functions) to read/write
ALTER TABLE public.pulse_scheduler_state ENABLE ROW LEVEL SECURITY;

-- Allow authenticated (or service_role) to select and update
CREATE POLICY "Service role can manage pulse_scheduler_state"
  ON public.pulse_scheduler_state
  FOR ALL
  USING (true)
  WITH CHECK (true);