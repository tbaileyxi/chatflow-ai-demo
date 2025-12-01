-- Add featured_order column for admin control of trending teams ranking
ALTER TABLE teams ADD COLUMN featured_order integer DEFAULT 999;

-- Add index for efficient sorting
CREATE INDEX idx_teams_featured_order ON teams(featured_order);