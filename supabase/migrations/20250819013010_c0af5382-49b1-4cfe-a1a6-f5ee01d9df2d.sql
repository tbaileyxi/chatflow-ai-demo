-- Fix the league constraint to include 'Other'
-- First check what constraints exist
SELECT conname, consrc FROM pg_constraint 
WHERE conrelid = 'teams'::regclass AND contype = 'c';

-- Drop and recreate the league constraint with 'Other' included
ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_league_check;
ALTER TABLE teams ADD CONSTRAINT teams_league_check 
CHECK (league IN ('NFL', 'NCAA', 'NBA', 'MLB', 'NHL', 'MLS', 'WNBA', 'Premier League', 'Other'));