-- Recalculate all pick correctness and entry scores for completed games

-- Update pick correctness for all final games with winning teams
UPDATE public.pickem_picks pp
SET is_correct = (pp.picked_team = pg.winning_team),
    updated_at = now()
FROM public.pickem_games pg
WHERE pp.game_id = pg.id
AND pg.status = 'final'
AND pg.winning_team IS NOT NULL
AND pp.is_correct IS DISTINCT FROM (pp.picked_team = pg.winning_team);

-- Recalculate total scores for all entries that had picks updated
UPDATE public.pickem_entries pe
SET total_score = (
  SELECT COALESCE(COUNT(*), 0)
  FROM public.pickem_picks pp2
  WHERE pp2.entry_id = pe.id
  AND pp2.is_correct = TRUE
),
updated_at = now()
WHERE EXISTS (
  SELECT 1 
  FROM public.pickem_picks pp3
  JOIN public.pickem_games pg3 ON pg3.id = pp3.game_id
  WHERE pp3.entry_id = pe.id
  AND pg3.status = 'final'
  AND pg3.winning_team IS NOT NULL
);