-- Add CHECK constraint to limit Pick 'Em max games to 5 or 10
ALTER TABLE public.huddle_pickem_settings 
ADD CONSTRAINT check_max_games_limit 
CHECK (max_games IN (5, 10));