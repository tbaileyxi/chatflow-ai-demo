-- Create game_states table to persist bot state between function calls
CREATE TABLE IF NOT EXISTS public.game_states (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id TEXT NOT NULL UNIQUE,
  last_score TEXT NOT NULL,
  last_period INTEGER NOT NULL DEFAULT 0,
  last_clock TEXT,
  last_status TEXT NOT NULL,
  teams JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_game_states_game_id ON public.game_states(game_id);
CREATE INDEX IF NOT EXISTS idx_game_states_updated_at ON public.game_states(updated_at);

-- Enable RLS
ALTER TABLE public.game_states ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage game states
CREATE POLICY "Service role can manage game states" 
ON public.game_states 
FOR ALL 
USING (true);

-- Add message_type and is_bot_message columns to huddle_messages if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'huddle_messages' AND column_name = 'is_bot_message') THEN
    ALTER TABLE public.huddle_messages ADD COLUMN is_bot_message BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'huddle_messages' AND column_name = 'message_type') THEN
    ALTER TABLE public.huddle_messages ADD COLUMN message_type TEXT;
  END IF;
END $$;