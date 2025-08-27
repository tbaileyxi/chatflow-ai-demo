-- Fix emoji constraint to allow all valid Unicode emojis including thumbs down
-- Drop the existing constraint that's blocking certain emojis
ALTER TABLE huddle_message_reactions DROP CONSTRAINT IF EXISTS huddle_message_reactions_emoji_check;

-- Add a new constraint that allows all valid Unicode emoji characters
ALTER TABLE huddle_message_reactions ADD CONSTRAINT huddle_message_reactions_emoji_check 
CHECK (emoji ~ '^[\p{Emoji}\p{Emoji_Modifier}\p{Emoji_Component}\p{Emoji_Presentation}]+$' OR length(emoji) > 0);