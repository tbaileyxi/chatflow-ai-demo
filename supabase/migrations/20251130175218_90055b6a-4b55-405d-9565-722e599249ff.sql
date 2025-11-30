-- Allow anonymous users to view public huddles and official team huddles
DROP POLICY IF EXISTS "Anyone can view public huddles for anonymous browsing" ON public.huddles;
CREATE POLICY "Anyone can view public huddles for anonymous browsing"
ON public.huddles
FOR SELECT
USING (
  (is_private = false) OR 
  (is_official_team_huddle = true)
);

-- Allow anonymous users to view messages in public huddles (read-only)
DROP POLICY IF EXISTS "Anonymous users can view messages in public huddles" ON public.huddle_messages;
CREATE POLICY "Anonymous users can view messages in public huddles"
ON public.huddle_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.huddles h
    WHERE h.id = huddle_messages.huddle_id
    AND (h.is_private = false OR h.is_official_team_huddle = true)
  )
);

-- Allow anonymous users to view public huddle members count
DROP POLICY IF EXISTS "Anyone can view public huddle members" ON public.huddle_members;
CREATE POLICY "Anyone can view public huddle members"
ON public.huddle_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.huddles h
    WHERE h.id = huddle_members.huddle_id
    AND (h.is_private = false OR h.is_official_team_huddle = true)
  )
);

-- Allow anonymous users to view reactions in public huddles
DROP POLICY IF EXISTS "Anyone can view reactions in public huddles" ON public.huddle_message_reactions;
CREATE POLICY "Anyone can view reactions in public huddles"
ON public.huddle_message_reactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM huddle_messages hm
    JOIN huddles h ON hm.huddle_id = h.id
    WHERE hm.id = huddle_message_reactions.message_id
    AND (h.is_private = false OR h.is_official_team_huddle = true)
  )
);

-- Allow anonymous users to view heat reactions in public huddles
DROP POLICY IF EXISTS "Anyone can view heat in public huddles" ON public.message_heat_reactions;
CREATE POLICY "Anyone can view heat in public huddles"
ON public.message_heat_reactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM huddle_messages hm
    JOIN huddles h ON hm.huddle_id = h.id
    WHERE hm.id = message_heat_reactions.message_id
    AND (h.is_private = false OR h.is_official_team_huddle = true)
  )
);