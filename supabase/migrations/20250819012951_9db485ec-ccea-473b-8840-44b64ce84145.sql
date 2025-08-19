-- Check current league constraint and fix it to include 'Other'
SELECT constraint_name, consrc FROM pg_constraint 
WHERE conrelid = 'teams'::regclass AND contype = 'c' AND consrc LIKE '%league%';

-- Drop the existing constraint if it exists
ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_league_check;

-- Add a new constraint that includes 'Other'
ALTER TABLE teams ADD CONSTRAINT teams_league_check 
CHECK (league IN ('NFL', 'NCAA', 'NBA', 'MLB', 'NHL', 'MLS', 'WNBA', 'Premier League', 'Other'));