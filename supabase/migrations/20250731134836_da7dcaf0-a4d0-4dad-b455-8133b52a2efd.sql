-- Create teams table
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  logo_url TEXT,
  conference TEXT,
  division TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(name, city)
);

-- Create posts table for both feed posts and huddle messages
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  media_url TEXT,
  author_id UUID,
  team_id UUID REFERENCES public.teams(id),
  is_spotlight BOOLEAN DEFAULT false,
  is_agent_post BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create post reactions table
CREATE TABLE IF NOT EXISTS public.post_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'fire')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id, reaction_type)
);

-- Enable Row Level Security
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for teams (public read)
DROP POLICY IF EXISTS "Teams are viewable by everyone" ON public.teams;
CREATE POLICY "Teams are viewable by everyone" 
ON public.teams FOR SELECT 
USING (true);

-- Create RLS policies for posts
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.posts;
CREATE POLICY "Posts are viewable by everyone" 
ON public.posts FOR SELECT 
USING (true);

-- Create RLS policies for post_reactions
DROP POLICY IF EXISTS "Reactions are viewable by everyone" ON public.post_reactions;
CREATE POLICY "Reactions are viewable by everyone" 
ON public.post_reactions FOR SELECT 
USING (true);

-- Insert NFL teams data
INSERT INTO public.teams (name, city, conference, division) VALUES
('Bills', 'Buffalo', 'AFC', 'East'),
('Dolphins', 'Miami', 'AFC', 'East'),
('Patriots', 'New England', 'AFC', 'East'),
('Jets', 'New York', 'AFC', 'East'),
('Ravens', 'Baltimore', 'AFC', 'North'),
('Bengals', 'Cincinnati', 'AFC', 'North'),
('Browns', 'Cleveland', 'AFC', 'North'),
('Steelers', 'Pittsburgh', 'AFC', 'North'),
('Texans', 'Houston', 'AFC', 'South'),
('Colts', 'Indianapolis', 'AFC', 'South'),
('Jaguars', 'Jacksonville', 'AFC', 'South'),
('Titans', 'Tennessee', 'AFC', 'South'),
('Broncos', 'Denver', 'AFC', 'West'),
('Chiefs', 'Kansas City', 'AFC', 'West'),
('Raiders', 'Las Vegas', 'AFC', 'West'),
('Chargers', 'Los Angeles', 'AFC', 'West'),
('Cowboys', 'Dallas', 'NFC', 'East'),
('Giants', 'New York', 'NFC', 'East'),
('Eagles', 'Philadelphia', 'NFC', 'East'),
('Commanders', 'Washington', 'NFC', 'East'),
('Bears', 'Chicago', 'NFC', 'North'),
('Lions', 'Detroit', 'NFC', 'North'),
('Packers', 'Green Bay', 'NFC', 'North'),
('Vikings', 'Minnesota', 'NFC', 'North'),
('Falcons', 'Atlanta', 'NFC', 'South'),
('Panthers', 'Carolina', 'NFC', 'South'),
('Saints', 'New Orleans', 'NFC', 'South'),
('Buccaneers', 'Tampa Bay', 'NFC', 'South'),
('Cardinals', 'Arizona', 'NFC', 'West'),
('Rams', 'Los Angeles', 'NFC', 'West'),
('49ers', 'San Francisco', 'NFC', 'West'),
('Seahawks', 'Seattle', 'NFC', 'West')
ON CONFLICT (name, city) DO NOTHING;

-- Create sample spotlight posts
INSERT INTO public.posts (content, team_id, is_spotlight, is_agent_post) VALUES
('🏈 BREAKING: Major trade rumors circulating around the league!', (SELECT id FROM public.teams WHERE city = 'Kansas City' LIMIT 1), true, true),
('⚡ Game highlights from last nights thriller are now available!', (SELECT id FROM public.teams WHERE city = 'Los Angeles' AND name = 'Chargers' LIMIT 1), true, true),
('🔥 Injury report: Key players questionable for this weeks matchup', (SELECT id FROM public.teams WHERE city = 'Buffalo' LIMIT 1), true, true);