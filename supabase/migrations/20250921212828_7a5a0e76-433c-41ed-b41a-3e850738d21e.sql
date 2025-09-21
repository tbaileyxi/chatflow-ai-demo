-- Drop the views since they can't have RLS directly
DROP VIEW IF EXISTS public.pickem_leaderboard CASCADE;
DROP VIEW IF EXISTS public.pickem_season_leaderboard CASCADE;
DROP VIEW IF EXISTS public.pickem_user_totals CASCADE;

-- Create secure functions instead of views that enforce proper access control

-- Function to get pick'em leaderboard for a specific instance
CREATE OR REPLACE FUNCTION public.get_pickem_leaderboard(target_instance_id uuid)
RETURNS TABLE(
    instance_id uuid,
    user_id uuid,
    total_score integer,
    rank bigint,
    display_name text,
    username text
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check if user has access to this instance
    IF NOT EXISTS (
        SELECT 1 
        FROM pickem_instances i
        JOIN huddle_members hm ON hm.huddle_id = i.huddle_id
        WHERE i.id = target_instance_id 
        AND hm.user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Access denied: You are not a member of this huddle';
    END IF;

    RETURN QUERY
    SELECT 
        pe.instance_id,
        pe.user_id,
        pe.total_score,
        rank() OVER (ORDER BY pe.total_score DESC, pe.created_at) AS rank,
        COALESCE(NULLIF(TRIM(BOTH FROM p.display_name), ''), NULLIF(TRIM(BOTH FROM p.username), ''), 'Anonymous') AS display_name,
        p.username
    FROM pickem_entries pe
    LEFT JOIN profiles p ON (p.user_id = pe.user_id AND p.status != 'banned')
    WHERE pe.instance_id = target_instance_id
    ORDER BY rank;
END;
$$;

-- Function to get season leaderboard (accessible to all authenticated users)
CREATE OR REPLACE FUNCTION public.get_pickem_season_leaderboard(target_league text DEFAULT 'ncaa', target_season integer DEFAULT EXTRACT(YEAR FROM NOW())::integer)
RETURNS TABLE(
    user_id uuid,
    display_name text,
    username text,
    league text,
    season_year integer,
    entries_played bigint,
    total_correct_picks bigint,
    win_percentage numeric,
    rank bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Require authentication
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    RETURN QUERY
    SELECT 
        e.user_id,
        p.display_name,
        p.username,
        w.league::text,
        w.season_year,
        count(DISTINCT e.instance_id) AS entries_played,
        COALESCE(sum(e.total_score), 0::bigint) AS total_correct_picks,
        round(
            CASE
                WHEN count(DISTINCT picks.id) > 0 THEN 
                    (COALESCE(sum(CASE WHEN picks.is_correct = true THEN 1 ELSE 0 END), 0::bigint)::numeric / count(DISTINCT picks.id)::numeric) * 100::numeric
                ELSE 0::numeric
            END, 1) AS win_percentage,
        rank() OVER (ORDER BY COALESCE(sum(e.total_score), 0::bigint) DESC, count(DISTINCT e.instance_id) DESC) AS rank
    FROM pickem_entries e
    JOIN profiles p ON (p.user_id = e.user_id AND p.status != 'banned')
    JOIN pickem_instances i ON (i.id = e.instance_id)
    JOIN pickem_weeks w ON (w.id = i.week_id)
    LEFT JOIN pickem_picks picks ON (picks.entry_id = e.id)
    WHERE w.league::text = target_league AND w.season_year = target_season
    GROUP BY e.user_id, p.display_name, p.username, w.league, w.season_year
    ORDER BY rank;
END;
$$;

-- Function to get user totals (accessible to all authenticated users for their own data)
CREATE OR REPLACE FUNCTION public.get_pickem_user_totals(target_user_id uuid DEFAULT NULL)
RETURNS TABLE(
    user_id uuid,
    league text,
    season_year integer,
    entries_played bigint,
    total_correct bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    query_user_id uuid;
BEGIN
    -- Require authentication
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- If no target user specified, use current user
    query_user_id := COALESCE(target_user_id, auth.uid());
    
    -- Users can only see their own totals unless they are admin
    IF query_user_id != auth.uid() AND NOT has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Access denied: You can only view your own statistics';
    END IF;

    RETURN QUERY
    SELECT 
        e.user_id,
        w.league::text,
        w.season_year,
        count(DISTINCT e.id) AS entries_played,
        COALESCE(sum(e.total_score), 0::bigint) AS total_correct
    FROM pickem_entries e
    JOIN pickem_instances i ON (i.id = e.instance_id)
    JOIN pickem_weeks w ON (w.id = i.week_id)
    WHERE e.user_id = query_user_id
    GROUP BY e.user_id, w.league, w.season_year;
END;
$$;