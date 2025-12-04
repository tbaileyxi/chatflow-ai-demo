-- Fix RLS policy: Allow authenticated users to view messages in public huddles
DROP POLICY IF EXISTS "Users can view messages in huddles they're members of" ON public.huddle_messages;

CREATE POLICY "Users can view messages in huddles they're members of or public huddles" 
ON public.huddle_messages 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.huddle_members 
    WHERE huddle_id = huddle_messages.huddle_id 
    AND user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.huddles h
    WHERE h.id = huddle_messages.huddle_id
    AND (h.is_private = false OR h.is_official_team_huddle = true)
  )
);

-- Backfill: Add all users who follow teams to their public huddles
INSERT INTO huddle_members (huddle_id, user_id, joined_at)
SELECT h.id, uf.user_id, NOW()
FROM user_follows uf
JOIN huddles h ON h.team_id = uf.team_id AND h.is_official_team_huddle = true
WHERE NOT EXISTS (
  SELECT 1 FROM huddle_members hm 
  WHERE hm.huddle_id = h.id AND hm.user_id = uf.user_id
)
ON CONFLICT (huddle_id, user_id) DO NOTHING;

-- Update member counts for all affected public huddles
UPDATE huddles h
SET member_count = (
  SELECT COUNT(*) FROM huddle_members hm WHERE hm.huddle_id = h.id
)
WHERE h.is_official_team_huddle = true;