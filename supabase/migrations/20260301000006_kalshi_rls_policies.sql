-- Add missing RLS read policy for kalshi_markets
-- This is the critical missing piece — RLS is enabled but no SELECT policy exists
CREATE POLICY "Anyone can view markets"
  ON public.kalshi_markets FOR SELECT
  USING (true);

-- shadow_bets: ensure users can read own + insert
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shadow_bets' AND policyname = 'Users can view own bets') THEN
    CREATE POLICY "Users can view own bets" ON public.shadow_bets FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shadow_bets' AND policyname = 'Users can place bets') THEN
    CREATE POLICY "Users can place bets" ON public.shadow_bets FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
