-- Fix Ole Miss: wrong league (NFL -> NCAA)
UPDATE teams SET league = 'NCAA' WHERE id = '0760551b-19c0-49eb-be19-bcdd168ee3c5' AND city = 'Ole Miss';

-- Create official huddle for Ole Miss if missing
INSERT INTO huddles (name, team_id, owner_id, is_official_team_huddle, is_private, bio)
SELECT 
  'Ole Miss Rebels Community',
  '0760551b-19c0-49eb-be19-bcdd168ee3c5',
  '176b171d-410c-4645-85d7-3bd9d4664289',
  true,
  false,
  'Welcome to the official Ole Miss Rebels community! Connect with fellow fans, share your thoughts, and stay updated. Hit the button above to create your own private Side Huddle!'
WHERE NOT EXISTS (
  SELECT 1 FROM huddles WHERE team_id = '0760551b-19c0-49eb-be19-bcdd168ee3c5' AND is_official_team_huddle = true
);