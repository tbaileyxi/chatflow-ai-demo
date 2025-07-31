-- Create profiles table for user information
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  phone_number TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member', 'huddle_owner')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create teams table
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  logo_url TEXT,
  conference TEXT,
  division TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create huddles table for private chats
CREATE TABLE IF NOT EXISTS public.huddles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id UUID NOT NULL,
  team_id UUID NOT NULL REFERENCES public.teams(id),
  is_private BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create posts table for both feed posts and huddle messages
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  media_url TEXT,
  author_id UUID,
  team_id UUID REFERENCES public.teams(id),
  huddle_id UUID REFERENCES public.huddles(id),
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

-- Create huddle members table
CREATE TABLE IF NOT EXISTS public.huddle_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  huddle_id UUID NOT NULL REFERENCES public.huddles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(huddle_id, user_id)
);

-- Create user follows table for team following
CREATE TABLE IF NOT EXISTS public.user_follows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, team_id)
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.huddles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.huddle_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for teams (public read)
CREATE POLICY IF NOT EXISTS "Teams are viewable by everyone" 
ON public.teams FOR SELECT 
USING (true);

-- Create RLS policies for posts
CREATE POLICY IF NOT EXISTS "Posts are viewable by everyone" 
ON public.posts FOR SELECT 
USING (true);

-- Create RLS policies for post_reactions
CREATE POLICY IF NOT EXISTS "Reactions are viewable by everyone" 
ON public.post_reactions FOR SELECT 
USING (true);

-- Insert NFL teams data
INSERT INTO public.teams (name, city, conference, division, logo_url) VALUES
('Bills', 'Buffalo', 'AFC', 'East', null),
('Dolphins', 'Miami', 'AFC', 'East', null),
('Patriots', 'New England', 'AFC', 'East', null),
('Jets', 'New York', 'AFC', 'East', null),
('Ravens', 'Baltimore', 'AFC', 'North', null),
('Bengals', 'Cincinnati', 'AFC', 'North', null),
('Browns', 'Cleveland', 'AFC', 'North', null),
('Steelers', 'Pittsburgh', 'AFC', 'North', null),
('Texans', 'Houston', 'AFC', 'South', null),
('Colts', 'Indianapolis', 'AFC', 'South', null),
('Jaguars', 'Jacksonville', 'AFC', 'South', null),
('Titans', 'Tennessee', 'AFC', 'South', null),
('Broncos', 'Denver', 'AFC', 'West', null),
('Chiefs', 'Kansas City', 'AFC', 'West', null),
('Raiders', 'Las Vegas', 'AFC', 'West', null),
('Chargers', 'Los Angeles', 'AFC', 'West', null),
('Cowboys', 'Dallas', 'NFC', 'East', null),
('Giants', 'New York', 'NFC', 'East', null),
('Eagles', 'Philadelphia', 'NFC', 'East', null),
('Commanders', 'Washington', 'NFC', 'East', null),
('Bears', 'Chicago', 'NFC', 'North', null),
('Lions', 'Detroit', 'NFC', 'North', null),
('Packers', 'Green Bay', 'NFC', 'North', null),
('Vikings', 'Minnesota', 'NFC', 'North', null),
('Falcons', 'Atlanta', 'NFC', 'South', null),
('Panthers', 'Carolina', 'NFC', 'South', null),
('Saints', 'New Orleans', 'NFC', 'South', null),
('Buccaneers', 'Tampa Bay', 'NFC', 'South', null),
('Cardinals', 'Arizona', 'NFC', 'West', null),
('Rams', 'Los Angeles', 'NFC', 'West', null),
('49ers', 'San Francisco', 'NFC', 'West', null),
('Seahawks', 'Seattle', 'NFC', 'West', null)
ON CONFLICT (name, city) DO NOTHING;

-- Create sample spotlight posts
INSERT INTO public.posts (content, team_id, is_spotlight, is_agent_post) VALUES
('🏈 BREAKING: Major trade rumors circulating around the league!', (SELECT id FROM public.teams WHERE city = 'Kansas City' LIMIT 1), true, true),
('⚡ Game highlights from last nights thriller are now available!', (SELECT id FROM public.teams WHERE city = 'Los Angeles' AND name = 'Chargers' LIMIT 1), true, true),
('🔥 Injury report: Key players questionable for this weeks matchup', (SELECT id FROM public.teams WHERE city = 'Buffalo' LIMIT 1), true, true);

-- Create update function for timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_teams_updated_at ON public.teams;
CREATE TRIGGER update_teams_updated_at
    BEFORE UPDATE ON public.teams
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_huddles_updated_at ON public.huddles;
CREATE TRIGGER update_huddles_updated_at
    BEFORE UPDATE ON public.huddles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_posts_updated_at ON public.posts;
CREATE TRIGGER update_posts_updated_at
    BEFORE UPDATE ON public.posts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();