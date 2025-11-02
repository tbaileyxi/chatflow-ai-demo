-- Create promo_codes table for verified huddle early adopter discounts
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed', 'free')),
  discount_value INTEGER, -- percentage (0-100) or cents off, null for 'free'
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  description TEXT
);

-- Enable RLS
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

-- Admins can manage promo codes
CREATE POLICY "Admins can manage promo codes"
  ON public.promo_codes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Anyone can view active promo codes (for validation)
CREATE POLICY "Anyone can view active promo codes"
  ON public.promo_codes
  FOR SELECT
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- Insert initial early adopter promo code
INSERT INTO public.promo_codes (code, discount_type, discount_value, max_uses, description)
VALUES ('EARLYBIRD', 'free', NULL, 100, 'Early adopter - 100% off verified huddle creation')
ON CONFLICT (code) DO NOTHING;

COMMENT ON TABLE public.promo_codes IS 'Promotional codes for verified huddle discounts';
COMMENT ON COLUMN public.promo_codes.discount_type IS 'Type: percentage (% off), fixed ($ off), free (100% off)';
COMMENT ON COLUMN public.promo_codes.discount_value IS 'Value: percentage 0-100, or cents for fixed discount, null for free';