-- Delete all broken highlight messages from huddle_messages
DELETE FROM public.huddle_messages 
WHERE message_type = 'highlight';

-- Drop the processed_highlights table since we no longer use it
DROP TABLE IF EXISTS public.processed_highlights;