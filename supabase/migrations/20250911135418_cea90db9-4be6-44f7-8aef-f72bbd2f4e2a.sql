-- Fix incorrectly finalized future games and add safeguards
-- Reset the two games that are incorrectly marked as final but scheduled in the future
UPDATE pickem_games 
SET status = 'scheduled', winning_team = NULL, updated_at = now()
WHERE id IN ('49414e47-1322-40da-9067-4ff94cf1d2c8', 'a1aae4ab-a7c7-473f-8494-01a8a4045b9d')
  AND start_time > now() 
  AND status = 'final';

-- Recalculate all affected Pick 'Em entry scores
-- First update all picks for these games to have is_correct = NULL since games aren't finished
UPDATE pickem_picks 
SET is_correct = NULL, updated_at = now()
WHERE game_id IN ('49414e47-1322-40da-9067-4ff94cf1d2c8', 'a1aae4ab-a7c7-473f-8494-01a8a4045b9d');

-- Recalculate entry totals for all affected entries
UPDATE pickem_entries pe
SET total_score = (
  SELECT COALESCE(COUNT(*), 0)
  FROM pickem_picks pp
  WHERE pp.entry_id = pe.id AND pp.is_correct = TRUE
), updated_at = now()
WHERE pe.id IN (
  SELECT DISTINCT pp.entry_id
  FROM pickem_picks pp
  WHERE pp.game_id IN ('49414e47-1322-40da-9067-4ff94cf1d2c8', 'a1aae4ab-a7c7-473f-8494-01a8a4045b9d')
);