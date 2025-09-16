-- Add thread support with embeds array containing commentary and embed data
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS embeds JSONB DEFAULT NULL;
ALTER TABLE public.huddle_messages ADD COLUMN IF NOT EXISTS embeds JSONB DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.posts.embeds IS 'Array of embed objects with commentary: [{"commentary": "text", "embed_code": "code", "embed_type": "x|iframe"}]';
COMMENT ON COLUMN public.huddle_messages.embeds IS 'Array of embed objects with commentary: [{"commentary": "text", "embed_code": "code", "embed_type": "x|iframe"}]';