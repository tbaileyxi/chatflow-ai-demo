-- Add origin attribution to posts and huddle messages
-- 1) Add origin_team_id to posts and huddle_messages with FKs to teams
ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS origin_team_id uuid NULL;

ALTER TABLE public.huddle_messages
ADD COLUMN IF NOT EXISTS origin_team_id uuid NULL;

-- Add foreign key constraints (safe if teams table exists). Use ON DELETE SET NULL to avoid cascading deletes
DO $$ BEGIN
  ALTER TABLE public.posts
    ADD CONSTRAINT posts_origin_team_id_fkey
    FOREIGN KEY (origin_team_id) REFERENCES public.teams(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.huddle_messages
    ADD CONSTRAINT huddle_messages_origin_team_id_fkey
    FOREIGN KEY (origin_team_id) REFERENCES public.teams(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;