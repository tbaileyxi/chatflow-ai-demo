-- Add verified status and join requests to huddles
ALTER TABLE public.huddles 
ADD COLUMN is_verified BOOLEAN DEFAULT false,
ADD COLUMN verification_expires_at TIMESTAMPTZ;

-- Create join requests table
CREATE TABLE public.huddle_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  huddle_id UUID NOT NULL REFERENCES public.huddles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  UNIQUE(huddle_id, user_id)
);

-- Create verified huddle subscriptions table
CREATE TABLE public.huddle_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  huddle_id UUID NOT NULL REFERENCES public.huddles(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(huddle_id)
);

-- Enable RLS
ALTER TABLE public.huddle_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.huddle_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS policies for huddle_join_requests
CREATE POLICY "Users can create join requests" ON public.huddle_join_requests
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own requests" ON public.huddle_join_requests
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Huddle owners can manage requests" ON public.huddle_join_requests
FOR ALL USING (EXISTS (
  SELECT 1 FROM public.huddles 
  WHERE huddles.id = huddle_join_requests.huddle_id 
  AND huddles.owner_id = auth.uid()
));

-- RLS policies for huddle_subscriptions
CREATE POLICY "Owners can view their subscriptions" ON public.huddle_subscriptions
FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Owners can insert their subscriptions" ON public.huddle_subscriptions
FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update their subscriptions" ON public.huddle_subscriptions
FOR UPDATE USING (auth.uid() = owner_id);

-- Function to update verification status based on subscription
CREATE OR REPLACE FUNCTION update_huddle_verification()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' AND NEW.expires_at > now() THEN
    UPDATE public.huddles 
    SET is_verified = true, verification_expires_at = NEW.expires_at
    WHERE id = NEW.huddle_id;
  ELSE
    UPDATE public.huddles 
    SET is_verified = false, verification_expires_at = null
    WHERE id = NEW.huddle_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update verification status
CREATE TRIGGER update_verification_status
  AFTER INSERT OR UPDATE ON public.huddle_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_huddle_verification();

-- Function to handle join request approval
CREATE OR REPLACE FUNCTION approve_huddle_join_request(request_id UUID)
RETURNS void AS $$
DECLARE
  req_record RECORD;
BEGIN
  -- Get the request details
  SELECT * INTO req_record FROM public.huddle_join_requests WHERE id = request_id;
  
  IF req_record IS NULL THEN
    RAISE EXCEPTION 'Join request not found';
  END IF;
  
  -- Update request status
  UPDATE public.huddle_join_requests 
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = request_id;
  
  -- Add user to huddle members
  INSERT INTO public.huddle_members (huddle_id, user_id)
  VALUES (req_record.huddle_id, req_record.user_id)
  ON CONFLICT (huddle_id, user_id) DO NOTHING;
  
  -- Update huddle member count
  UPDATE public.huddles 
  SET member_count = member_count + 1, last_message_at = now()
  WHERE id = req_record.huddle_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;