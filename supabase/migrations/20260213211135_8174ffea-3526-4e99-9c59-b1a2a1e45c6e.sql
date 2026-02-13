-- Clear all existing team_id values so the re-sync assigns them correctly
UPDATE kalshi_markets SET team_id = NULL WHERE team_id IS NOT NULL;