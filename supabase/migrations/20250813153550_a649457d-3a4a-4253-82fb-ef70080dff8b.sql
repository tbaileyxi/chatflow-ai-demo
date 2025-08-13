-- Create Bears_Trending table for storing X (Twitter) posts
CREATE TABLE public.bears_trending (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id TEXT NOT NULL UNIQUE,
  embed_url TEXT NOT NULL,
  likes INTEGER NOT NULL DEFAULT 0,
  retweets INTEGER NOT NULL DEFAULT 0,
  rank_score INTEGER DEFAULT NULL,
  content TEXT,
  author_username TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bears_trending ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access
CREATE POLICY "Admins can view all trending posts" 
ON public.bears_trending 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'::app_role
  )
);

CREATE POLICY "Admins can insert trending posts" 
ON public.bears_trending 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'::app_role
  )
);

CREATE POLICY "Admins can update trending posts" 
ON public.bears_trending 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'::app_role
  )
);

-- Create index for better performance
CREATE INDEX idx_bears_trending_rank_score ON public.bears_trending (rank_score DESC);
CREATE INDEX idx_bears_trending_fetched_at ON public.bears_trending (fetched_at DESC);