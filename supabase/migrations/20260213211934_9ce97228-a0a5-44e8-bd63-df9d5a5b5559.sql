-- Activate existing coming_soon teams
UPDATE teams SET status = 'active' WHERE id IN (
  '5fcc6b69-da55-4951-9432-d8a08daf464a',  -- Auburn Tigers
  '4077fcb4-a4b9-4624-896c-a8cee9c17f87',  -- LSU Tigers
  '74594ba8-a023-4aa2-9ce2-e152db2bf1da',  -- Tennessee Volunteers
  'd732be6e-add5-446a-b1ab-917abf739196'   -- Miami Hurricanes
);

-- Activate Ole Miss if it exists as non-active
UPDATE teams SET status = 'active' WHERE name = 'Rebels' AND city = 'Ole Miss' AND league = 'NCAA';

-- Insert Tulane and James Madison (new teams)
INSERT INTO teams (name, city, league, status, logo_url) VALUES
  ('Green Wave', 'Tulane', 'NCAA', 'active', 'https://a.espncdn.com/i/teamlogos/ncaa/500/2655.png'),
  ('Dukes', 'James Madison', 'NCAA', 'active', 'https://a.espncdn.com/i/teamlogos/ncaa/500/256.png');

-- Create official huddles for teams that don't have one yet
INSERT INTO huddles (name, team_id, owner_id, is_official_team_huddle, is_private, bio)
SELECT 
  t.city || ' ' || t.name || ' Community',
  t.id,
  '176b171d-410c-4645-85d7-3bd9d4664289',
  true,
  false,
  'Welcome to the official ' || t.city || ' ' || t.name || ' community! Connect with fellow fans, share your thoughts, and stay updated. Hit the button above to create your own private Side Huddle!'
FROM teams t
WHERE t.city IN ('Ole Miss', 'Tulane', 'James Madison') AND t.league = 'NCAA'
AND NOT EXISTS (
  SELECT 1 FROM huddles h WHERE h.team_id = t.id AND h.is_official_team_huddle = true
);