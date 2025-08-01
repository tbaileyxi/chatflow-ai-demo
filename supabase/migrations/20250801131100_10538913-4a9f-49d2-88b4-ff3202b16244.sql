-- Create spotlight voting system
CREATE TABLE public.spotlight_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL,
  user_id UUID NOT NULL,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Enable RLS
ALTER TABLE public.spotlight_votes ENABLE ROW LEVEL SECURITY;

-- Create policies for spotlight votes
CREATE POLICY "Users can view all spotlight votes" 
ON public.spotlight_votes 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create their own votes" 
ON public.spotlight_votes 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own votes" 
ON public.spotlight_votes 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own votes" 
ON public.spotlight_votes 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create spotlight reporting system
CREATE TABLE public.spotlight_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL,
  user_id UUID NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(post_id, user_id)
);

-- Enable RLS
ALTER TABLE public.spotlight_reports ENABLE ROW LEVEL SECURITY;

-- Create policies for spotlight reports
CREATE POLICY "Users can create reports" 
ON public.spotlight_reports 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own reports" 
ON public.spotlight_reports 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all reports" 
ON public.spotlight_reports 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM user_roles 
  WHERE user_id = auth.uid() AND role = 'admin'::app_role
));

CREATE POLICY "Admins can update reports" 
ON public.spotlight_reports 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM user_roles 
  WHERE user_id = auth.uid() AND role = 'admin'::app_role
));

-- Add vote score calculation function
CREATE OR REPLACE FUNCTION calculate_post_vote_score(post_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  up_votes INTEGER;
  down_votes INTEGER;
BEGIN
  SELECT COUNT(*) INTO up_votes 
  FROM spotlight_votes 
  WHERE post_id = post_uuid AND vote_type = 'up';
  
  SELECT COUNT(*) INTO down_votes 
  FROM spotlight_votes 
  WHERE post_id = post_uuid AND vote_type = 'down';
  
  RETURN COALESCE(up_votes, 0) - COALESCE(down_votes, 0);
END;
$$ LANGUAGE plpgsql;

-- Create indexes for performance
CREATE INDEX idx_spotlight_votes_post_id ON public.spotlight_votes(post_id);
CREATE INDEX idx_spotlight_votes_user_id ON public.spotlight_votes(user_id);
CREATE INDEX idx_spotlight_reports_post_id ON public.spotlight_reports(post_id);
CREATE INDEX idx_spotlight_reports_status ON public.spotlight_reports(status);