-- Create sponsor_reservations table to track team sponsorship status
CREATE TABLE public.sponsor_reservations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  reserved_by_name TEXT NOT NULL,
  reserved_by_company TEXT NOT NULL,
  reserved_email TEXT NOT NULL,
  stripe_payment_id TEXT,
  stripe_session_id TEXT,
  deposit_amount INTEGER NOT NULL DEFAULT 14900, -- $149 in cents
  status TEXT NOT NULL DEFAULT 'reserved', -- reserved, cancelled
  reservation_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(team_id)
);

-- Create sponsor_waitlist table for teams that are already reserved
CREATE TABLE public.sponsor_waitlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.sponsor_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsor_waitlist ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sponsor_reservations
CREATE POLICY "Anyone can view reservations for status checks"
  ON public.sponsor_reservations
  FOR SELECT
  USING (true);

CREATE POLICY "Service can manage reservations"
  ON public.sponsor_reservations
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS Policies for sponsor_waitlist
CREATE POLICY "Anyone can join waitlist"
  ON public.sponsor_waitlist
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service can manage waitlist"
  ON public.sponsor_waitlist
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add index for faster lookups
CREATE INDEX idx_sponsor_reservations_team_id ON public.sponsor_reservations(team_id);
CREATE INDEX idx_sponsor_waitlist_team_id ON public.sponsor_waitlist(team_id);