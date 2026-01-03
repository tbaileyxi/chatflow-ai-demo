ALTER TABLE public.pulse_runs
  ADD COLUMN IF NOT EXISTS xai_model text,
  ADD COLUMN IF NOT EXISTS xai_tool_calls_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS xai_x_search_calls integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS xai_web_search_calls integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS xai_has_key boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS xai_debug jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_pulse_runs_event_ran_at ON public.pulse_runs (event_id, ran_at DESC);
CREATE INDEX IF NOT EXISTS idx_pulse_runs_huddle_ran_at ON public.pulse_runs (huddle_id, ran_at DESC);