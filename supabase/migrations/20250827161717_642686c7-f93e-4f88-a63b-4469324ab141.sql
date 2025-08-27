-- Fix emoji constraint issue by removing restrictive constraint
-- Drop the existing constraint that's blocking certain emojis like thumbs down
ALTER TABLE huddle_message_reactions DROP CONSTRAINT IF EXISTS huddle_message_reactions_emoji_check;

-- Add a simple constraint that just requires non-empty emoji
ALTER TABLE huddle_message_reactions ADD CONSTRAINT huddle_message_reactions_emoji_check 
CHECK (length(emoji) > 0);