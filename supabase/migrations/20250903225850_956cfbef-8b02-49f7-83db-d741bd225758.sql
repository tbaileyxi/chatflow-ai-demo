-- Create a view for season-long Pick'em leaderboards
CREATE OR REPLACE VIEW public.pickem_season_leaderboard AS
SELECT 
  e.user_id,
  p.display_name,
  p.username,
  w.league,
  w.season_year,
  COUNT(DISTINCT e.instance_id) as entries_played,
  COALESCE(SUM(e.total_score), 0) as total_correct_picks,
  ROUND(
    CASE 
      WHEN COUNT(DISTINCT picks.id) > 0 
      THEN (COALESCE(SUM(CASE WHEN picks.is_correct = true THEN 1 ELSE 0 END), 0)::decimal / COUNT(DISTINCT picks.id)::decimal) * 100 
      ELSE 0 
    END, 
    1
  ) as win_percentage,
  RANK() OVER (
    PARTITION BY w.league, w.season_year 
    ORDER BY COALESCE(SUM(e.total_score), 0) DESC, COUNT(DISTINCT e.instance_id) DESC
  ) as rank
FROM public.pickem_entries e
JOIN public.profiles p ON p.user_id = e.user_id
JOIN public.pickem_instances i ON i.id = e.instance_id
JOIN public.pickem_weeks w ON w.id = i.week_id
LEFT JOIN public.pickem_picks picks ON picks.entry_id = e.id
WHERE p.status != 'banned'
GROUP BY e.user_id, p.display_name, p.username, w.league, w.season_year
ORDER BY w.league, w.season_year, rank;

-- Grant access to authenticated users
GRANT SELECT ON public.pickem_season_leaderboard TO authenticated;