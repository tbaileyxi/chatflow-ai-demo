-- Fix the leaderboard view to properly show display names and create missing view
DROP VIEW IF EXISTS pickem_leaderboard;

CREATE VIEW pickem_leaderboard AS
SELECT 
  pe.instance_id,
  pe.user_id,
  pe.total_score,
  RANK() OVER (PARTITION BY pe.instance_id ORDER BY pe.total_score DESC, pe.created_at ASC) as rank,
  COALESCE(NULLIF(TRIM(p.display_name), ''), NULLIF(TRIM(p.username), ''), 'Anonymous') as display_name,
  p.username
FROM pickem_entries pe
LEFT JOIN profiles p ON p.user_id = pe.user_id
ORDER BY pe.instance_id, rank;

-- Ensure all database triggers are properly set up
-- Trigger to update picks when game results change
DROP TRIGGER IF EXISTS update_picks_on_game_result_trigger ON pickem_games;
CREATE TRIGGER update_picks_on_game_result_trigger
  AFTER UPDATE ON pickem_games
  FOR EACH ROW
  EXECUTE FUNCTION update_picks_and_scores_after_game_update();

-- Trigger to recalculate scores when picks change  
DROP TRIGGER IF EXISTS update_entry_score_trigger ON pickem_picks;
CREATE TRIGGER update_entry_score_trigger
  AFTER INSERT OR UPDATE ON pickem_picks
  FOR EACH ROW
  EXECUTE FUNCTION update_entry_score_after_pick();

-- Trigger to close instances when all games are final
DROP TRIGGER IF EXISTS check_close_instances_trigger ON pickem_games;
CREATE TRIGGER check_close_instances_trigger
  AFTER UPDATE ON pickem_games
  FOR EACH ROW
  EXECUTE FUNCTION check_and_close_pickem_instances();