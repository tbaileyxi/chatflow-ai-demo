-- Add founding member columns to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_founding_member boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS founding_tier text CHECK (founding_tier IN ('charter', 'founding')),
  ADD COLUMN IF NOT EXISTS founding_spot_number integer CHECK (founding_spot_number >= 1 AND founding_spot_number <= 300),
  ADD COLUMN IF NOT EXISTS has_lifetime_verified_huddle_code boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_huddle_promo_code text,
  ADD COLUMN IF NOT EXISTS founding_purchased_at timestamp with time zone;

-- Create unique constraint on spot number
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_founding_spot_number 
  ON public.profiles(founding_spot_number) 
  WHERE founding_spot_number IS NOT NULL;

-- Create index for fast count queries
CREATE INDEX IF NOT EXISTS idx_profiles_founding_tier 
  ON public.profiles(founding_tier) 
  WHERE founding_tier IS NOT NULL;

-- Create function to get founding counts (for real-time counters)
CREATE OR REPLACE FUNCTION public.get_founding_counts()
RETURNS TABLE (charter_count bigint, founding_count bigint, total_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COUNT(*) FILTER (WHERE founding_tier = 'charter'),
    COUNT(*) FILTER (WHERE founding_tier = 'founding'),
    COUNT(*) FILTER (WHERE founding_tier IS NOT NULL)
  FROM profiles
  WHERE is_founding_member = true;
$$;

-- Create function to get next spot number (atomic operation)
CREATE OR REPLACE FUNCTION public.claim_founding_spot(
  p_user_id uuid,
  p_tier text,
  p_promo_code text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_spot_number integer;
  v_charter_count integer;
  v_founding_count integer;
BEGIN
  -- Get current counts
  SELECT 
    COUNT(*) FILTER (WHERE founding_tier = 'charter'),
    COUNT(*) FILTER (WHERE founding_tier = 'founding')
  INTO v_charter_count, v_founding_count
  FROM profiles
  WHERE is_founding_member = true;

  -- Check limits
  IF p_tier = 'charter' AND v_charter_count >= 100 THEN
    RAISE EXCEPTION 'Charter spots sold out';
  END IF;
  
  IF p_tier = 'founding' AND v_founding_count >= 200 THEN
    RAISE EXCEPTION 'Founding spots sold out';
  END IF;

  -- Calculate next spot number
  v_spot_number := v_charter_count + v_founding_count + 1;

  -- Update the user's profile atomically
  UPDATE profiles
  SET 
    is_founding_member = true,
    founding_tier = p_tier,
    founding_spot_number = v_spot_number,
    has_lifetime_verified_huddle_code = true,
    verified_huddle_promo_code = p_promo_code,
    founding_purchased_at = now()
  WHERE user_id = p_user_id;

  RETURN v_spot_number;
END;
$$;

-- Grant execute permission on functions
GRANT EXECUTE ON FUNCTION public.get_founding_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_founding_counts() TO anon;