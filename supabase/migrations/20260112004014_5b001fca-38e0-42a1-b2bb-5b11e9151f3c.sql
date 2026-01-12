-- STEP 1: Add settlement_status column to fades table for tracking payment
ALTER TABLE public.fades 
ADD COLUMN IF NOT EXISTS settlement_status text NOT NULL DEFAULT 'unpaid'
CHECK (settlement_status IN ('unpaid', 'paid_unverified', 'paid_verified'));

-- STEP 2: Add paid_by and confirmed_by columns for tracking who marked payment
ALTER TABLE public.fades 
ADD COLUMN IF NOT EXISTS paid_marked_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS paid_marked_by uuid,
ADD COLUMN IF NOT EXISTS paid_confirmed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS paid_confirmed_by uuid;

-- STEP 3: Create cash_mode_subscriptions table for premium membership
CREATE TABLE IF NOT EXISTS public.cash_mode_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  stripe_customer_id text,
  stripe_subscription_id text,
  venmo_username text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL
);

-- Enable RLS on cash_mode_subscriptions
ALTER TABLE public.cash_mode_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own Cash Mode subscription
CREATE POLICY "Users can view own cash mode subscription"
ON public.cash_mode_subscriptions
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own subscription
CREATE POLICY "Users can update own cash mode subscription"
ON public.cash_mode_subscriptions
FOR UPDATE
USING (auth.uid() = user_id);

-- System can manage all subscriptions (for webhook)
CREATE POLICY "Service can manage cash mode subscriptions"
ON public.cash_mode_subscriptions
FOR ALL
USING (true)
WITH CHECK (true);

-- STEP 4: Add policy for updating settlement status on fades
CREATE POLICY "Participants can update settlement status"
ON public.fades
FOR UPDATE
USING (
  status = 'settled' 
  AND (auth.uid() = poster_id OR auth.uid() = accepter_id)
)
WITH CHECK (
  status = 'settled'
  AND (auth.uid() = poster_id OR auth.uid() = accepter_id)
  AND settlement_status IN ('unpaid', 'paid_unverified', 'paid_verified')
);

-- STEP 5: Create index for faster fade queries
CREATE INDEX IF NOT EXISTS idx_fades_huddle_status ON public.fades(huddle_id, status);
CREATE INDEX IF NOT EXISTS idx_fades_game_commence ON public.fades(game_commence_time);
CREATE INDEX IF NOT EXISTS idx_cash_mode_user ON public.cash_mode_subscriptions(user_id);