-- Fix posts table policies to allow admin broadcasting
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.posts;

-- Create comprehensive policies for posts table
CREATE POLICY "Posts are viewable by everyone" ON public.posts
FOR SELECT 
USING (true);

CREATE POLICY "Admins can create posts" ON public.posts
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

CREATE POLICY "Authors can update their posts" ON public.posts
FOR UPDATE 
USING (author_id = auth.uid());

CREATE POLICY "Admins can update any posts" ON public.posts
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

CREATE POLICY "Admins can delete posts" ON public.posts
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);