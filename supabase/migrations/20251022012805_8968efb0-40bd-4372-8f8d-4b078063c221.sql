-- Create huddle chatbot settings table
CREATE TABLE huddle_chatbot_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  huddle_id UUID NOT NULL REFERENCES huddles(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  personality TEXT DEFAULT 'hype' CHECK (personality IN ('hype', 'analytical', 'casual')),
  response_max_words INTEGER DEFAULT 150,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(huddle_id)
);

-- Create index for faster lookups
CREATE INDEX idx_huddle_chatbot_settings_huddle_id ON huddle_chatbot_settings(huddle_id);

-- Enable RLS
ALTER TABLE huddle_chatbot_settings ENABLE ROW LEVEL SECURITY;

-- Owners can manage chatbot settings
CREATE POLICY "Owners can manage chatbot settings"
  ON huddle_chatbot_settings FOR ALL
  USING (EXISTS (
    SELECT 1 FROM huddles 
    WHERE huddles.id = huddle_chatbot_settings.huddle_id 
    AND huddles.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM huddles 
    WHERE huddles.id = huddle_chatbot_settings.huddle_id 
    AND huddles.owner_id = auth.uid()
  ));

-- Members can view chatbot settings
CREATE POLICY "Members can view chatbot settings"
  ON huddle_chatbot_settings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM huddle_members 
    WHERE huddle_members.huddle_id = huddle_chatbot_settings.huddle_id 
    AND huddle_members.user_id = auth.uid()
  ));

-- Create function to auto-enable bot for new huddles
CREATE OR REPLACE FUNCTION create_default_chatbot_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO huddle_chatbot_settings (huddle_id, is_enabled)
  VALUES (NEW.id, true)
  ON CONFLICT (huddle_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-enable chatbot on huddle creation
CREATE TRIGGER auto_enable_chatbot_on_huddle_creation
  AFTER INSERT ON huddles
  FOR EACH ROW
  EXECUTE FUNCTION create_default_chatbot_settings();

-- Backfill existing huddles with enabled bot
INSERT INTO huddle_chatbot_settings (huddle_id, is_enabled)
SELECT id, true FROM huddles
ON CONFLICT (huddle_id) DO NOTHING;