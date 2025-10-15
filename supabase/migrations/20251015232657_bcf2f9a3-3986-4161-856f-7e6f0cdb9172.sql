-- Add Highlightly integration columns to teams table
ALTER TABLE teams 
ADD COLUMN IF NOT EXISTS highlightly_id INTEGER,
ADD COLUMN IF NOT EXISTS highlightly_display_name TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_teams_highlightly_id ON teams(highlightly_id);

-- Create table to track processed highlights (prevent duplicates)
CREATE TABLE IF NOT EXISTS processed_highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  highlight_id INTEGER NOT NULL,
  match_id INTEGER NOT NULL,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  posted_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(highlight_id)
);

-- Enable RLS
ALTER TABLE processed_highlights ENABLE ROW LEVEL SECURITY;

-- Service role can manage highlights
CREATE POLICY "Service role can manage highlights"
ON processed_highlights FOR ALL
USING (true);

-- Create index for faster duplicate checks
CREATE INDEX IF NOT EXISTS idx_processed_highlights_highlight_id ON processed_highlights(highlight_id);
CREATE INDEX IF NOT EXISTS idx_processed_highlights_match_id ON processed_highlights(match_id);
CREATE INDEX IF NOT EXISTS idx_processed_highlights_posted_at ON processed_highlights(posted_at);

-- Add match_id column to pickem_games (renaming espn_game_id conceptually)
ALTER TABLE pickem_games 
ADD COLUMN IF NOT EXISTS match_id TEXT;