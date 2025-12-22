-- Create table to store team-to-subreddit mappings
CREATE TABLE public.team_subreddits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  subreddit_name TEXT NOT NULL,
  rss_url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(team_id)
);

-- Create table to track fetched posts to prevent duplicates
CREATE TABLE public.reddit_posts_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  reddit_post_id TEXT NOT NULL,
  title TEXT,
  url TEXT,
  content_hash TEXT,
  posted_to_huddle_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(team_id, reddit_post_id)
);

-- Create table to track daily post counts per huddle
CREATE TABLE public.reddit_daily_counts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  huddle_id UUID NOT NULL REFERENCES public.huddles(id) ON DELETE CASCADE,
  post_date DATE NOT NULL DEFAULT CURRENT_DATE,
  post_count INTEGER DEFAULT 0,
  UNIQUE(huddle_id, post_date)
);

-- Enable RLS
ALTER TABLE public.team_subreddits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reddit_posts_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reddit_daily_counts ENABLE ROW LEVEL SECURITY;

-- Admin-only policies for team_subreddits
CREATE POLICY "Admins can manage team subreddits"
  ON public.team_subreddits
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Read-only for authenticated users  
CREATE POLICY "Authenticated users can view team subreddits"
  ON public.team_subreddits
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Service role policies for logs (edge functions will use service role)
CREATE POLICY "Service can manage reddit posts log"
  ON public.reddit_posts_log
  FOR ALL
  USING (true);

CREATE POLICY "Service can manage daily counts"
  ON public.reddit_daily_counts
  FOR ALL
  USING (true);

-- Insert initial team-to-subreddit mappings
INSERT INTO public.team_subreddits (team_id, subreddit_name, rss_url)
SELECT id, 'CHIBears', 'https://www.reddit.com/r/CHIBears/.rss'
FROM public.teams WHERE name ILIKE '%Bears%' AND city ILIKE '%Chicago%'
ON CONFLICT (team_id) DO NOTHING;

INSERT INTO public.team_subreddits (team_id, subreddit_name, rss_url)
SELECT id, 'Gamecocks', 'https://www.reddit.com/r/Gamecocks/.rss'
FROM public.teams WHERE name ILIKE '%Gamecocks%'
ON CONFLICT (team_id) DO NOTHING;

INSERT INTO public.team_subreddits (team_id, subreddit_name, rss_url)
SELECT id, 'NYGiants', 'https://www.reddit.com/r/NYGiants/.rss'
FROM public.teams WHERE name ILIKE '%Giants%' AND city ILIKE '%New York%'
ON CONFLICT (team_id) DO NOTHING;

INSERT INTO public.team_subreddits (team_id, subreddit_name, rss_url)
SELECT id, 'GreenBayPackers', 'https://www.reddit.com/r/GreenBayPackers/.rss'
FROM public.teams WHERE name ILIKE '%Packers%'
ON CONFLICT (team_id) DO NOTHING;

INSERT INTO public.team_subreddits (team_id, subreddit_name, rss_url)
SELECT id, 'detroitlions', 'https://www.reddit.com/r/detroitlions/.rss'
FROM public.teams WHERE name ILIKE '%Lions%'
ON CONFLICT (team_id) DO NOTHING;

INSERT INTO public.team_subreddits (team_id, subreddit_name, rss_url)
SELECT id, 'cowboys', 'https://www.reddit.com/r/cowboys/.rss'
FROM public.teams WHERE name ILIKE '%Cowboys%'
ON CONFLICT (team_id) DO NOTHING;

INSERT INTO public.team_subreddits (team_id, subreddit_name, rss_url)
SELECT id, 'KansasCityChiefs', 'https://www.reddit.com/r/KansasCityChiefs/.rss'
FROM public.teams WHERE name ILIKE '%Chiefs%'
ON CONFLICT (team_id) DO NOTHING;

INSERT INTO public.team_subreddits (team_id, subreddit_name, rss_url)
SELECT id, 'buffalobills', 'https://www.reddit.com/r/buffalobills/.rss'
FROM public.teams WHERE name ILIKE '%Bills%'
ON CONFLICT (team_id) DO NOTHING;

INSERT INTO public.team_subreddits (team_id, subreddit_name, rss_url)
SELECT id, 'eagles', 'https://www.reddit.com/r/eagles/.rss'
FROM public.teams WHERE name ILIKE '%Eagles%'
ON CONFLICT (team_id) DO NOTHING;

INSERT INTO public.team_subreddits (team_id, subreddit_name, rss_url)
SELECT id, '49ers', 'https://www.reddit.com/r/49ers/.rss'
FROM public.teams WHERE name ILIKE '%49ers%'
ON CONFLICT (team_id) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX idx_reddit_posts_log_team_created ON public.reddit_posts_log(team_id, created_at DESC);
CREATE INDEX idx_reddit_daily_counts_date ON public.reddit_daily_counts(post_date);