-- Create social sources table to manage X Lists per team
CREATE TABLE public.social_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL DEFAULT 'x_list',
  source_url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create team trending table for curated content
CREATE TABLE public.team_trending (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  post_id TEXT NOT NULL,
  embed_url TEXT NOT NULL,
  content TEXT,
  author_username TEXT,
  likes INTEGER NOT NULL DEFAULT 0,
  retweets INTEGER NOT NULL DEFAULT 0,
  replies INTEGER NOT NULL DEFAULT 0,
  rank_score INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected, broadcasted
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(post_id, team_id)
);

-- Enable RLS
ALTER TABLE public.social_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_trending ENABLE ROW LEVEL SECURITY;

-- RLS Policies for social_sources
CREATE POLICY "Admins can manage social sources" 
ON public.social_sources 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = auth.uid() AND role = 'admin'::app_role
));

CREATE POLICY "Users can view social sources" 
ON public.social_sources 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- RLS Policies for team_trending
CREATE POLICY "Admins can manage team trending" 
ON public.team_trending 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = auth.uid() AND role = 'admin'::app_role
));

CREATE POLICY "Users can view approved team trending" 
ON public.team_trending 
FOR SELECT 
USING (status = 'approved' AND auth.uid() IS NOT NULL);

-- Create indexes for performance
CREATE INDEX idx_social_sources_team_id ON public.social_sources(team_id);
CREATE INDEX idx_social_sources_active ON public.social_sources(is_active);
CREATE INDEX idx_team_trending_team_id ON public.team_trending(team_id);
CREATE INDEX idx_team_trending_status ON public.team_trending(status);
CREATE INDEX idx_team_trending_rank_score ON public.team_trending(rank_score DESC);
CREATE INDEX idx_team_trending_post_id ON public.team_trending(post_id);

-- Add trigger for updated_at
CREATE TRIGGER update_social_sources_updated_at
  BEFORE UPDATE ON public.social_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add some seed data for your teams if you have them
-- You can add your X List URLs here or through the admin interface