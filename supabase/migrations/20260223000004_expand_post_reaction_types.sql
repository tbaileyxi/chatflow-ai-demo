-- Expand post_reactions to support W, L, fire, like reactions
ALTER TABLE public.post_reactions DROP CONSTRAINT IF EXISTS post_reactions_reaction_type_check;
ALTER TABLE public.post_reactions ADD CONSTRAINT post_reactions_reaction_type_check
  CHECK (reaction_type IN ('like', 'fire', 'W', 'L'));

-- Allow authenticated users to insert their own reactions
DROP POLICY IF EXISTS "Users can add reactions" ON public.post_reactions;
CREATE POLICY "Users can add reactions"
ON public.post_reactions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own reactions
DROP POLICY IF EXISTS "Users can remove own reactions" ON public.post_reactions;
CREATE POLICY "Users can remove own reactions"
ON public.post_reactions FOR DELETE
USING (auth.uid() = user_id);
