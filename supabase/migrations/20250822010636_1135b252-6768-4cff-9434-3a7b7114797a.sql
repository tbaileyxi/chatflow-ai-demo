-- Create RLS policies for spotlight_votes table
ALTER TABLE public.spotlight_votes ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own votes
CREATE POLICY "Users can insert their own votes" 
ON public.spotlight_votes 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Allow users to view all votes (for calculating scores)
CREATE POLICY "Users can view all votes" 
ON public.spotlight_votes 
FOR SELECT 
USING (true);

-- Allow users to update their own votes
CREATE POLICY "Users can update their own votes" 
ON public.spotlight_votes 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Allow users to delete their own votes
CREATE POLICY "Users can delete their own votes" 
ON public.spotlight_votes 
FOR DELETE 
USING (auth.uid() = user_id);