-- Phase 1: Critical Privacy Protection - Secure User Behavioral Data
-- Update spotlight_votes RLS policies to hide individual voting patterns
DROP POLICY IF EXISTS "Users can view all spotlight votes" ON public.spotlight_votes;
CREATE POLICY "Users can view vote counts only" ON public.spotlight_votes
FOR SELECT USING (false); -- Block individual vote viewing

-- Update poll_votes RLS policies to hide individual voting patterns  
DROP POLICY IF EXISTS "Users can view all poll votes" ON public.poll_votes;
CREATE POLICY "Users can view their own votes only" ON public.poll_votes
FOR SELECT USING (user_id = auth.uid());

-- Update user_follows RLS policies to prevent behavioral profiling
DROP POLICY IF EXISTS "Users can view all follows" ON public.user_follows;
CREATE POLICY "Users can view their own follows only" ON public.user_follows
FOR SELECT USING (user_id = auth.uid());

-- Keep post_reactions private to prevent stalking
DROP POLICY IF EXISTS "Reactions are viewable by everyone" ON public.post_reactions;
CREATE POLICY "Users can view their own reactions only" ON public.post_reactions
FOR SELECT USING (user_id = auth.uid());

-- Phase 3: Database Security Hardening - Fix Function Security
-- Update database functions to include proper search_path settings
CREATE OR REPLACE FUNCTION public.calculate_post_vote_score(post_uuid uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_huddle_member(_huddle_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.huddle_members 
    WHERE huddle_id = _huddle_id AND user_id = _user_id
  );
END;
$function$;

-- Secure team_waitlist email data
DROP POLICY IF EXISTS "Users can join waitlists" ON public.team_waitlist;
CREATE POLICY "Users can join waitlists anonymously" ON public.team_waitlist
FOR INSERT WITH CHECK (true);

-- Create function to get vote counts without exposing individual votes
CREATE OR REPLACE FUNCTION public.get_post_vote_counts(post_uuid uuid)
RETURNS TABLE(up_votes bigint, down_votes bigint, total_votes bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(CASE WHEN vote_type = 'up' THEN 1 ELSE 0 END), 0) as up_votes,
    COALESCE(SUM(CASE WHEN vote_type = 'down' THEN 1 ELSE 0 END), 0) as down_votes,
    COUNT(*) as total_votes
  FROM spotlight_votes 
  WHERE post_id = post_uuid;
END;
$function$;

-- Create function to get poll vote counts without exposing individual votes
CREATE OR REPLACE FUNCTION public.get_poll_vote_counts(post_uuid uuid)
RETURNS TABLE(option_id integer, vote_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    pv.option_id,
    COUNT(*) as vote_count
  FROM poll_votes pv
  WHERE pv.post_id = post_uuid
  GROUP BY pv.option_id;
END;
$function$;