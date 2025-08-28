-- Drop the overly permissive policy that allows everyone to view all posts
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.posts;

-- Create granular RLS policies for different post types and visibility levels

-- 1. Allow users to view their own posts (always)
CREATE POLICY "Users can view their own posts" 
ON public.posts 
FOR SELECT 
USING (author_id = auth.uid());

-- 2. Allow viewing of public spotlight posts (is_spotlight = true)
CREATE POLICY "Public spotlight posts are viewable by everyone" 
ON public.posts 
FOR SELECT 
USING (
  is_spotlight = true 
  AND auth.uid() IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() AND status = 'banned'
  )
);

-- 3. Allow viewing team posts for team followers
CREATE POLICY "Team followers can view team posts" 
ON public.posts 
FOR SELECT 
USING (
  team_id IS NOT NULL 
  AND is_spotlight = false 
  AND huddle_id IS NULL
  AND auth.uid() IS NOT NULL
  AND (
    -- User follows this team
    EXISTS (
      SELECT 1 FROM user_follows 
      WHERE user_id = auth.uid() AND team_id = posts.team_id
    )
    OR
    -- User is the author
    author_id = auth.uid()
  )
  AND NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() AND status = 'banned'
  )
);

-- 4. Allow viewing huddle posts for huddle members only
CREATE POLICY "Huddle members can view huddle posts" 
ON public.posts 
FOR SELECT 
USING (
  huddle_id IS NOT NULL 
  AND auth.uid() IS NOT NULL
  AND (
    -- User is a member of the huddle
    is_huddle_member(huddle_id, auth.uid())
    OR
    -- User is the author
    author_id = auth.uid()
    OR
    -- User owns the huddle
    EXISTS (
      SELECT 1 FROM huddles 
      WHERE id = posts.huddle_id AND owner_id = auth.uid()
    )
  )
  AND NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() AND status = 'banned'
  )
);

-- 5. Handle any edge cases for posts without clear categorization
CREATE POLICY "Fallback policy for uncategorized posts" 
ON public.posts 
FOR SELECT 
USING (
  -- Only if none of the above conditions apply and user is the author
  team_id IS NULL 
  AND huddle_id IS NULL 
  AND is_spotlight = false
  AND author_id = auth.uid()
  AND auth.uid() IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() AND status = 'banned'
  )
);