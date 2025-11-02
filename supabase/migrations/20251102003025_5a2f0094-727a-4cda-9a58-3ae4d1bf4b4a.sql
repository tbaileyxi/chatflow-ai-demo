-- Phase B: Add Grok AI analysis columns to team_trending table
ALTER TABLE team_trending
ADD COLUMN IF NOT EXISTS grok_analysis JSONB,
ADD COLUMN IF NOT EXISTS quality_score INTEGER,
ADD COLUMN IF NOT EXISTS has_media BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS media_type TEXT,
ADD COLUMN IF NOT EXISTS topics TEXT[],
ADD COLUMN IF NOT EXISTS highlight_worthy BOOLEAN DEFAULT false;

-- Add index for quality filtering
CREATE INDEX IF NOT EXISTS idx_team_trending_quality ON team_trending(quality_score DESC) WHERE quality_score IS NOT NULL;

-- Add index for highlight filtering
CREATE INDEX IF NOT EXISTS idx_team_trending_highlights ON team_trending(highlight_worthy) WHERE highlight_worthy = true;