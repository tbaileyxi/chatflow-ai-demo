-- The X on a notification did nothing, and Clear all did nothing, for the same
-- reason: notifications had SELECT, UPDATE and INSERT policies and no DELETE
-- one. The client's .delete() matched zero rows under RLS, returned no error,
-- and the row was still there after the refetch — a dismiss button that lies.
--
-- A notification is yours and nobody else can see it, so deleting your own is
-- the same permission as reading it.
CREATE POLICY "Users can delete their own notifications"
ON public.notifications
FOR DELETE
USING (auth.uid() = user_id);
