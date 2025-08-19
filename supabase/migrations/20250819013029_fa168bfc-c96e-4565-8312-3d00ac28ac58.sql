-- Drop the existing league constraint that doesn't include 'Other'
ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_league_check;

-- Add new constraint that includes 'Other'
ALTER TABLE teams ADD CONSTRAINT teams_league_check 
CHECK (league IN ('NFL', 'NCAA', 'NBA', 'MLB', 'NHL', 'MLS', 'WNBA', 'Premier League', 'Other'));