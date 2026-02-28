-- Allow users to always read their own shadow bets (for the Ledger/portfolio view)
-- The existing policy only allows reading bets if user is a huddle member,
-- which breaks the personal ledger when a user leaves a huddle.
CREATE POLICY "Users can read their own bets"
  ON public.shadow_bets FOR SELECT
  USING (auth.uid() = user_id);
