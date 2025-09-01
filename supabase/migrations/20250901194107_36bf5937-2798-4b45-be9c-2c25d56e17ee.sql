
-- Allow authenticated (non-banned) users to create their own Spotlight posts
-- (Admins already can via the existing policy.)
CREATE POLICY "Users can create spotlight posts"
ON public.posts
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND author_id = auth.uid()
  AND is_spotlight = true
  AND target_audience @> ARRAY['spotlight']::text[]
  AND NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.status = 'banned'
  )
);
