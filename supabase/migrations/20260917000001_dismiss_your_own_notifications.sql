-- The DELETE policy on notifications exists in production but was never in a
-- migration here, so a fresh database would come up without it and the X on a
-- notification would delete nothing, silently — RLS matching zero rows returns
-- no error. This records it. It is idempotent because production already has
-- it under this exact name.
--
-- A notification is yours and nobody else can see it, so deleting your own is
-- the same permission as reading it.
DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;

CREATE POLICY "Users can delete their own notifications"
ON public.notifications
FOR DELETE
USING (auth.uid() = user_id);
