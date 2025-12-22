-- Table to track when users last received an email notification
CREATE TABLE public.user_email_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  last_email_sent_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_email_notifications ENABLE ROW LEVEL SECURITY;

-- Service role policy for the edge function
CREATE POLICY "Service role can manage email notifications"
ON public.user_email_notifications
FOR ALL
USING (true)
WITH CHECK (true);

-- Users can view their own notification settings
CREATE POLICY "Users can view their own email notification status"
ON public.user_email_notifications
FOR SELECT
USING (user_id = auth.uid());

-- Create trigger for updated_at
CREATE TRIGGER update_user_email_notifications_updated_at
BEFORE UPDATE ON public.user_email_notifications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();