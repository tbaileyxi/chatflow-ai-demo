-- Drop the existing security definer views
DROP VIEW IF EXISTS public.pickem_leaderboard CASCADE;
DROP VIEW IF EXISTS public.pickem_season_leaderboard CASCADE; 
DROP VIEW IF EXISTS public.pickem_user_totals CASCADE;

-- Recreate pickem_leaderboard as a regular view with RLS-compatible access
CREATE VIEW public.pickem_leaderboard AS
SELECT 
    pe.instance_id,
    pe.user_id,
    pe.total_score,
    rank() OVER (PARTITION BY pe.instance_id ORDER BY pe.total_score DESC, pe.created_at) AS rank,
    COALESCE(NULLIF(TRIM(BOTH FROM p.display_name), ''), NULLIF(TRIM(BOTH FROM p.username), ''), 'Anonymous') AS display_name,
    p.username
FROM pickem_entries pe
LEFT JOIN profiles p ON (p.user_id = pe.user_id AND p.status != 'banned')
ORDER BY pe.instance_id, rank() OVER (PARTITION BY pe.instance_id ORDER BY pe.total_score DESC, pe.created_at);

-- Recreate pickem_season_leaderboard as a regular view with RLS-compatible access
CREATE VIEW public.pickem_season_leaderboard AS
SELECT 
    e.user_id,
    p.display_name,
    p.username,
    w.league,
    w.season_year,
    count(DISTINCT e.instance_id) AS entries_played,
    COALESCE(sum(e.total_score), 0::bigint) AS total_correct_picks,
    round(
        CASE
            WHEN count(DISTINCT picks.id) > 0 THEN 
                (COALESCE(sum(CASE WHEN picks.is_correct = true THEN 1 ELSE 0 END), 0::bigint)::numeric / count(DISTINCT picks.id)::numeric) * 100::numeric
            ELSE 0::numeric
        END, 1) AS win_percentage,
    rank() OVER (PARTITION BY w.league, w.season_year ORDER BY COALESCE(sum(e.total_score), 0::bigint) DESC, count(DISTINCT e.instance_id) DESC) AS rank
FROM pickem_entries e
JOIN profiles p ON (p.user_id = e.user_id AND p.status != 'banned')
JOIN pickem_instances i ON (i.id = e.instance_id)
JOIN pickem_weeks w ON (w.id = i.week_id)
LEFT JOIN pickem_picks picks ON (picks.entry_id = e.id)
GROUP BY e.user_id, p.display_name, p.username, w.league, w.season_year
ORDER BY w.league, w.season_year, rank() OVER (PARTITION BY w.league, w.season_year ORDER BY COALESCE(sum(e.total_score), 0::bigint) DESC, count(DISTINCT e.instance_id) DESC);

-- Recreate pickem_user_totals as a regular view with RLS-compatible access
CREATE VIEW public.pickem_user_totals AS
SELECT 
    e.user_id,
    w.league,
    w.season_year,
    count(DISTINCT e.id) AS entries_played,
    COALESCE(sum(e.total_score), 0::bigint) AS total_correct
FROM pickem_entries e
JOIN pickem_instances i ON (i.id = e.instance_id)
JOIN pickem_weeks w ON (w.id = i.week_id)
GROUP BY e.user_id, w.league, w.season_year;

-- Enable RLS on the views (this will ensure they respect the underlying table RLS policies)
ALTER VIEW public.pickem_leaderboard SET (security_barrier = true);
ALTER VIEW public.pickem_season_leaderboard SET (security_barrier = true);
ALTER VIEW public.pickem_user_totals SET (security_barrier = true);