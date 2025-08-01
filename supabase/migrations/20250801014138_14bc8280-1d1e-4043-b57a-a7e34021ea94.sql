-- Add embed_code column to huddle_messages table for Twitter/X embeds
ALTER TABLE public.huddle_messages 
ADD COLUMN embed_code text;