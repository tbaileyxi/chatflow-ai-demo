-- Fix Week 1 scoring by removing invalid picks and allowing users to make new picks on NCAA games

-- Delete all existing picks for Week 1 since they were made on NFL games but instance now has NCAA games
DELETE FROM public.pickem_picks pp
WHERE pp.entry_id IN (
  SELECT pe.id 
  FROM public.pickem_entries pe
  JOIN public.pickem_instances pi ON pi.id = pe.instance_id
  WHERE pi.title LIKE '%Week 1%'
);

-- Reset all Week 1 entry scores to 0
UPDATE public.pickem_entries pe
SET total_score = 0, updated_at = now()
WHERE pe.instance_id IN (
  SELECT pi.id 
  FROM public.pickem_instances pi 
  WHERE pi.title LIKE '%Week 1%'
);