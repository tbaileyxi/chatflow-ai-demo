-- Create app roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'member', 'huddle_owner');

-- Create user_roles table for role management
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role app_role NOT NULL DEFAULT 'member',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Create profiles table for user information
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  phone_number TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enhance teams table for NCAA/NFL
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS league TEXT CHECK (league IN ('NFL', 'NCAA'));
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS stats JSONB DEFAULT '{}';
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS description TEXT;

-- Create huddles table for private chats
CREATE TABLE IF NOT EXISTS public.huddles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id UUID NOT NULL,
  team_id UUID NOT NULL REFERENCES public.teams(id),
  is_private BOOLEAN DEFAULT true,
  member_count INTEGER DEFAULT 1,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create huddle members table
CREATE TABLE IF NOT EXISTS public.huddle_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  huddle_id UUID NOT NULL REFERENCES public.huddles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_read_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(huddle_id, user_id)
);

-- Enhance posts table for broadcast center
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'poll', 'upload', 'embed'));
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS poll_data JSONB;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS target_audience TEXT[] DEFAULT ARRAY['team_feed'];
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'sent';
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS huddle_id UUID REFERENCES public.huddles(id);

-- Create user follows table for team following
CREATE TABLE IF NOT EXISTS public.user_follows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, team_id)
);

-- Create security definer function to check user roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to get current user role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1
$$;

-- Enable Row Level Security
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.huddles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.huddle_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles" ON public.user_roles
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles" ON public.user_roles
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles" ON public.user_roles
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles
FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON public.profiles
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own profile" ON public.profiles
FOR INSERT WITH CHECK (user_id = auth.uid());

-- RLS Policies for huddles
CREATE POLICY "Users can view public huddles" ON public.huddles
FOR SELECT USING (NOT is_private);

CREATE POLICY "Members can view their huddles" ON public.huddles
FOR SELECT USING (
  id IN (
    SELECT huddle_id FROM public.huddle_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create huddles" ON public.huddles
FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update their huddles" ON public.huddles
FOR UPDATE USING (owner_id = auth.uid());

-- RLS Policies for huddle_members
CREATE POLICY "Members can view huddle membership" ON public.huddle_members
FOR SELECT USING (
  huddle_id IN (
    SELECT huddle_id FROM public.huddle_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Huddle owners can manage members" ON public.huddle_members
FOR ALL USING (
  huddle_id IN (
    SELECT id FROM public.huddles WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Users can join huddles" ON public.huddle_members
FOR INSERT WITH CHECK (user_id = auth.uid());

-- RLS Policies for user_follows
CREATE POLICY "Users can view all follows" ON public.user_follows
FOR SELECT USING (true);

CREATE POLICY "Users can manage their own follows" ON public.user_follows
FOR ALL USING (user_id = auth.uid());

-- Update league info for existing teams
UPDATE public.teams SET league = 'NFL' WHERE conference IN ('AFC', 'NFC');

-- Insert some sample NCAA teams
INSERT INTO public.teams (name, city, conference, division, league) VALUES
('Crimson Tide', 'Alabama', 'SEC', 'West', 'NCAA'),
('Tigers', 'Auburn', 'SEC', 'West', 'NCAA'),
('Bulldogs', 'Georgia', 'SEC', 'East', 'NCAA'),
('Gators', 'Florida', 'SEC', 'East', 'NCAA'),
('Volunteers', 'Tennessee', 'SEC', 'East', 'NCAA'),
('Wildcats', 'Kentucky', 'SEC', 'East', 'NCAA'),
('Aggies', 'Texas A&M', 'SEC', 'West', 'NCAA'),
('Tigers', 'LSU', 'SEC', 'West', 'NCAA')
ON CONFLICT (name, city) DO NOTHING;

-- Create sample admin user role (you'll need to update this with actual user_id)
-- INSERT INTO public.user_roles (user_id, role) VALUES ('00000000-0000-0000-0000-000000000000', 'admin');

-- Create triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_huddles_updated_at ON public.huddles;
CREATE TRIGGER update_huddles_updated_at
    BEFORE UPDATE ON public.huddles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();