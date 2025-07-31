-- Create storage buckets for media uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-media', 'chat-media', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('broadcast-media', 'broadcast-media', true);

-- Create storage policies for chat media
CREATE POLICY "Chat media is publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'chat-media');

CREATE POLICY "Users can upload chat media" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'chat-media' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their chat media" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'chat-media' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their chat media" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'chat-media' AND auth.uid() IS NOT NULL);

-- Create storage policies for broadcast media
CREATE POLICY "Broadcast media is publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'broadcast-media');

CREATE POLICY "Admins can upload broadcast media" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'broadcast-media' AND EXISTS (
  SELECT 1 FROM user_roles 
  WHERE user_id = auth.uid() AND role = 'admin'::app_role
));

CREATE POLICY "Admins can update broadcast media" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'broadcast-media' AND EXISTS (
  SELECT 1 FROM user_roles 
  WHERE user_id = auth.uid() AND role = 'admin'::app_role
));

CREATE POLICY "Admins can delete broadcast media" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'broadcast-media' AND EXISTS (
  SELECT 1 FROM user_roles 
  WHERE user_id = auth.uid() AND role = 'admin'::app_role
));

-- Add media_type column to huddle_messages for media uploads
ALTER TABLE public.huddle_messages 
ADD COLUMN media_url text,
ADD COLUMN media_type text DEFAULT 'text';

-- Add embed_code column to posts for better embed handling
ALTER TABLE public.posts 
ADD COLUMN embed_code text;