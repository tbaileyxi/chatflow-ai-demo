-- Clean up duplicate Pick 'Em instances
-- Delete all duplicate "NFL Week 1 2024 - Restored" instances for this huddle that have no entries
DELETE FROM public.pickem_instance_games 
WHERE instance_id IN (
  SELECT pi.id 
  FROM public.pickem_instances pi
  LEFT JOIN public.pickem_entries pe ON pe.instance_id = pi.id
  WHERE pi.huddle_id = 'c59e32f9-37ef-42b8-b1c3-423888feff49'
    AND pi.title LIKE '%Restored%'
    AND pe.id IS NULL
);

DELETE FROM public.pickem_instances 
WHERE huddle_id = 'c59e32f9-37ef-42b8-b1c3-423888feff49'
  AND title LIKE '%Restored%'
  AND id NOT IN (
    SELECT DISTINCT pe.instance_id 
    FROM public.pickem_entries pe 
    WHERE pe.instance_id IS NOT NULL
  );

-- Trigger scoring for Week 2 NFL 2025 to ensure proper scores
SELECT public.update_picks_and_scores_after_game_update();