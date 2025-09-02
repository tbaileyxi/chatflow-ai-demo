-- Create huddle membership pricing table
CREATE TABLE public.huddle_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  huddle_id UUID NOT NULL REFERENCES public.huddles(id) ON DELETE CASCADE,
  price_per_month INTEGER NOT NULL, -- in cents (e.g., 199 for $1.99)
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(huddle_id)
);

-- Enable RLS
ALTER TABLE public.huddle_pricing ENABLE ROW LEVEL SECURITY;

-- Policies for huddle pricing
CREATE POLICY "Owners can manage their huddle pricing" 
ON public.huddle_pricing 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.huddles 
  WHERE huddles.id = huddle_pricing.huddle_id 
  AND huddles.owner_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.huddles 
  WHERE huddles.id = huddle_pricing.huddle_id 
  AND huddles.owner_id = auth.uid()
));

-- Members can view pricing for huddles they have access to
CREATE POLICY "Members can view huddle pricing" 
ON public.huddle_pricing 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.huddle_members hm
  JOIN public.huddles h ON h.id = hm.huddle_id
  WHERE h.id = huddle_pricing.huddle_id 
  AND hm.user_id = auth.uid()
) OR EXISTS (
  SELECT 1 FROM public.huddles 
  WHERE huddles.id = huddle_pricing.huddle_id 
  AND huddles.owner_id = auth.uid()
));

-- Create huddle member subscriptions table to track member payments
CREATE TABLE public.huddle_member_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  huddle_id UUID NOT NULL REFERENCES public.huddles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(huddle_id, user_id)
);

-- Enable RLS for member subscriptions
ALTER TABLE public.huddle_member_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies for member subscriptions
CREATE POLICY "Users can view their own subscriptions" 
ON public.huddle_member_subscriptions 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Owners can view their huddle subscriptions" 
ON public.huddle_member_subscriptions 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.huddles 
  WHERE huddles.id = huddle_member_subscriptions.huddle_id 
  AND huddles.owner_id = auth.uid()
));

-- Edge functions can manage subscriptions
CREATE POLICY "System can manage subscriptions" 
ON public.huddle_member_subscriptions 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Add updated_at trigger
CREATE TRIGGER update_huddle_pricing_updated_at
BEFORE UPDATE ON public.huddle_pricing
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_huddle_member_subscriptions_updated_at
BEFORE UPDATE ON public.huddle_member_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();