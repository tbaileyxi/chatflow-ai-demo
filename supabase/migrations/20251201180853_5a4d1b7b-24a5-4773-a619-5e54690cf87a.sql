-- Add RLS policy to allow public viewing of profile names (for huddle owner display)
CREATE POLICY "Anyone can view public profile names for huddles"
ON profiles FOR SELECT
USING (status != 'banned' AND (display_name IS NOT NULL OR username IS NOT NULL));