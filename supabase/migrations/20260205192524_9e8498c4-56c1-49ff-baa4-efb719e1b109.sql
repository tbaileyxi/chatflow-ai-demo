-- Create the og-pages bucket for storing OG HTML pages
INSERT INTO storage.buckets (id, name, public)
VALUES ('og-pages', 'og-pages', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read objects from the og-pages bucket (for crawlers/iMessage)
CREATE POLICY "Public read access for og-pages"
ON storage.objects
FOR SELECT
USING (bucket_id = 'og-pages');