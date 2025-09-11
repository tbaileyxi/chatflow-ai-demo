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

-- Create function to prevent duplicate instance creation
CREATE OR REPLACE FUNCTION public.prevent_duplicate_pickem_instances()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if an instance already exists for this huddle and week
  IF EXISTS (
    SELECT 1 FROM public.pickem_instances 
    WHERE huddle_id = NEW.huddle_id 
    AND week_id = NEW.week_id
  ) THEN
    RAISE EXCEPTION 'Pick Em instance already exists for this huddle and week';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to prevent duplicates
DROP TRIGGER IF EXISTS prevent_duplicate_instances ON public.pickem_instances;
CREATE TRIGGER prevent_duplicate_instances
  BEFORE INSERT ON public.pickem_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_duplicate_pickem_instances();