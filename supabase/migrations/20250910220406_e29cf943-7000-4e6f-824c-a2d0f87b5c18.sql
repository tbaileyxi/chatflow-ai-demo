-- Fix Week 1 Pick 'Em by switching from scheduled NFL games to completed NCAA games

-- First, remove the current NFL games from Week 1 instance
DELETE FROM public.pickem_instance_games pig
WHERE pig.instance_id IN (
  SELECT pi.id FROM public.pickem_instances pi WHERE pi.title LIKE '%Week 1%'
);

-- Add the completed NCAA Week 1 games to the Week 1 instance
INSERT INTO public.pickem_instance_games (instance_id, game_id)
SELECT 
  pi.id as instance_id,
  pg.id as game_id
FROM public.pickem_instances pi
CROSS JOIN public.pickem_games pg
JOIN public.pickem_weeks pw ON pw.id = pg.week_id
WHERE pi.title LIKE '%Week 1%'
AND pw.league = 'ncaaf'
AND pw.week_number = 1
AND pw.season_year = 2025
AND pg.status = 'final'
AND pg.winning_team IS NOT NULL
LIMIT 10;

-- Update the Week 1 instance week_id to point to NCAA Week 1
UPDATE public.pickem_instances pi
SET week_id = (
  SELECT pw.id 
  FROM public.pickem_weeks pw 
  WHERE pw.league = 'ncaaf' 
  AND pw.week_number = 1 
  AND pw.season_year = 2025
  LIMIT 1
)
WHERE pi.title LIKE '%Week 1%';

-- Now recalculate picks for the updated Week 1 instance
UPDATE public.pickem_picks pp
SET is_correct = (pp.picked_team = pg.winning_team),
    updated_at = now()
FROM public.pickem_games pg
JOIN public.pickem_instance_games pig ON pig.game_id = pg.id
JOIN public.pickem_instances pi ON pi.id = pig.instance_id
WHERE pp.game_id = pg.id
AND pi.title LIKE '%Week 1%'
AND pg.status = 'final'
AND pg.winning_team IS NOT NULL;