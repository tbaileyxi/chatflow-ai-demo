-- Add origin_post_id to huddle_messages and cascade deletes when a post is removed
ALTER TABLE public.huddle_messages
ADD COLUMN IF NOT EXISTS origin_post_id uuid;

-- Create foreign key with ON DELETE CASCADE so related chat messages are removed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'huddle_messages_origin_post_fk'
  ) THEN
    ALTER TABLE public.huddle_messages
    ADD CONSTRAINT huddle_messages_origin_post_fk
    FOREIGN KEY (origin_post_id)
    REFERENCES public.posts(id)
    ON DELETE CASCADE;
  END IF;
END $$;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_huddle_messages_origin_post_id
ON public.huddle_messages(origin_post_id);