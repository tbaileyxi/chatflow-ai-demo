-- Update one game to be completed for testing
UPDATE pickem_games 
SET status = 'final', winning_team = 'Green Bay Packers'
WHERE espn_game_id = '401772936';

-- Update another game with a different winner 
UPDATE pickem_games 
SET status = 'final', winning_team = 'Cincinnati Bengals'
WHERE espn_game_id = '401772725';

-- This will trigger the database triggers to update pick correctness and scores