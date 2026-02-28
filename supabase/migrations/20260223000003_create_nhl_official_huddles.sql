-- Create official public huddles for all NHL teams that don't have one yet
INSERT INTO public.huddles (name, team_id, owner_id, is_private, is_official_team_huddle, member_count, bio)
SELECT
  t.city || ' ' || t.name || ' Community' as name,
  t.id as team_id,
  '00000000-0000-0000-0000-000000000000' as owner_id,
  false as is_private,
  true as is_official_team_huddle,
  0 as member_count,
  'Welcome to the official ' || t.city || ' ' || t.name || ' community! Connect with fellow fans, share your thoughts, and stay updated.' as bio
FROM teams t
LEFT JOIN huddles h ON h.team_id = t.id AND h.is_official_team_huddle = true
WHERE t.league = 'NHL'
  AND t.status = 'active'
  AND h.id IS NULL;
