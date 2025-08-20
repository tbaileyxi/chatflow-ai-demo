-- Fix the profiles table constraint issue
-- Clean up any potential duplicates by keeping the first one created

WITH duplicates AS (
  SELECT user_id, 
         ARRAY_AGG(id ORDER BY created_at) as ids
  FROM profiles 
  GROUP BY user_id 
  HAVING COUNT(*) > 1
)
DELETE FROM profiles 
WHERE id IN (
  SELECT UNNEST(ids[2:]) 
  FROM duplicates
);

-- Ensure unique constraint exists on user_id
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_user_id_unique'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);
  END IF;
END $$;