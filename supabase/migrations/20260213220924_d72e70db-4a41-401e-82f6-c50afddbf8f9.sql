
-- shares table
CREATE TABLE public.shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  bet_id uuid REFERENCES public.shadow_bets(id),
  platform text NOT NULL,
  shared_content_type text NOT NULL DEFAULT 'win',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own shares"
ON public.shares FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read their own shares"
ON public.shares FOR SELECT
USING (auth.uid() = user_id);

-- referrals table
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referred_by uuid NOT NULL,
  new_user_id uuid,
  source_share_id uuid REFERENCES public.shares(id),
  referral_code text UNIQUE,
  joined_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own referrals"
ON public.referrals FOR SELECT
USING (auth.uid() = referred_by);

CREATE POLICY "Users can insert their own referrals"
ON public.referrals FOR INSERT
WITH CHECK (auth.uid() = referred_by);
