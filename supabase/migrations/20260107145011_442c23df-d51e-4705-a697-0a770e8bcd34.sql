-- Reset stale live states (data from Jan 4th is outdated)
UPDATE teams_live_state 
SET state = 'normal', 
    active_game_id = NULL, 
    active_opponent_team_id = NULL, 
    home_score = NULL, 
    away_score = NULL,
    updated_at = now()
WHERE updated_at < now() - interval '24 hours';