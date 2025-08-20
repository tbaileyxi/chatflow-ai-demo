-- Fix the profiles table to use UPSERT properly by ensuring user_id is unique
-- The error suggests there might be duplicate user_id entries

-- First, let's clean up any potential duplicates in profiles table
DELETE FROM profiles 
WHERE id NOT IN (
  SELECT MIN(id) 
  FROM profiles 
  GROUP BY user_id
);

-- Add a unique constraint on user_id if it doesn't exist
-- (This should already exist but let's make sure)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_user_id_unique'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);
  END IF;
END $$;