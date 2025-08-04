-- Add poll_data column to huddle_messages table
ALTER TABLE public.huddle_messages 
ADD COLUMN poll_data JSONB;