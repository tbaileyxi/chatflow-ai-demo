-- Add bio column to huddles table
ALTER TABLE huddles 
ADD COLUMN bio TEXT;

-- Add a comment explaining the column
COMMENT ON COLUMN huddles.bio IS 'Optional bio/description for the huddle, editable by owner';