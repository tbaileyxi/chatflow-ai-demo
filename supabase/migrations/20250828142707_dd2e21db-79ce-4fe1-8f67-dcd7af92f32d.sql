-- Allow admins to insert broadcast messages into any huddle regardless of membership
-- This addresses RLS violations when broadcasting from the admin panel

-- Ensure huddle_messages table has RLS enabled (no-op if already enabled)
ALTER TABLE IF EXISTS public.huddle_messages ENABLE ROW LEVEL SECURITY;

-- Create policy for admin inserts if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'huddle_messages' 
      AND policyname = 'Admins can insert broadcast messages into any huddle'
  ) THEN
    CREATE POLICY "Admins can insert broadcast messages into any huddle"
    ON public.huddle_messages
    FOR INSERT
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END$$;

-- Optionally, allow admins to update/delete any huddle messages if needed in future (kept disabled by default)
-- DO $$
-- BEGIN
--   IF NOT EXISTS (
--     SELECT 1 FROM pg_policies 
--     WHERE schemaname = 'public' 
--       AND tablename = 'huddle_messages' 
--       AND policyname = 'Admins can update huddle messages'
--   ) THEN
--     CREATE POLICY "Admins can update huddle messages"
--     ON public.huddle_messages
--     FOR UPDATE
--     USING (public.has_role(auth.uid(), 'admin'))
--     WITH CHECK (public.has_role(auth.uid(), 'admin'));
--   END IF;
-- END$$;

-- No changes to existing member-based policies; this is additive and scoped to admins only.
