import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Bot, Info, TestTube } from "lucide-react";

export const HuddleChatbotSettings = () => {
  const { huddleId } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  const [personality, setPersonality] = useState<'hype' | 'analytical' | 'casual'>('hype');

  useEffect(() => {
    if (huddleId) {
      loadSettings();
    }
  }, [huddleId]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('huddle_chatbot_settings')
        .select('*')
        .eq('huddle_id', huddleId)
        .single();

      if (error && error.code !== 'PGRST116') { // Ignore "not found" error
        console.error('Error loading settings:', error);
        toast.error('Failed to load settings');
        return;
      }

      if (data) {
        setIsEnabled(data.is_enabled);
        setPersonality(data.personality as 'hype' | 'analytical' | 'casual');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const { error } = await supabase
        .from('huddle_chatbot_settings')
        .upsert({
          huddle_id: huddleId,
          is_enabled: isEnabled,
          personality: personality,
        });

      if (error) throw error;

      toast.success('Coach settings saved!');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to test');
        return;
      }

      // Post a test message
      const { error } = await supabase
        .from('huddle_messages')
        .insert({
          huddle_id: huddleId,
          user_id: user.id,
          content: '@coach test - what\'s happening with the team?',
        });

      if (error) throw error;

      toast.success('Test message sent! Check your huddle chat for Coach\'s response.');
    } catch (error) {
      console.error('Error testing bot:', error);
      toast.error('Failed to send test message');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Coach Chatbot
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          Coach Chatbot
        </CardTitle>
        <CardDescription>
          Configure your team's AI chatbot assistant
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between space-x-2">
          <div className="space-y-0.5">
            <Label htmlFor="coach-enabled" className="text-base">
              Status
            </Label>
            <p className="text-sm text-muted-foreground">
              {isEnabled ? '● Enabled' : '○ Disabled'}
            </p>
          </div>
          <Switch
            id="coach-enabled"
            checked={isEnabled}
            onCheckedChange={setIsEnabled}
          />
        </div>

        {/* Personality Selector */}
        <div className="space-y-2">
          <Label htmlFor="personality">Personality</Label>
          <Select value={personality} onValueChange={(value) => setPersonality(value as 'hype' | 'analytical' | 'casual')}>
            <SelectTrigger id="personality">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hype">🔥 Hype - Energetic and passionate</SelectItem>
              <SelectItem value="analytical">📊 Analytical - Strategic and data-driven</SelectItem>
              <SelectItem value="casual">😎 Casual - Laid-back and friendly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Info Alert */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Users can interact with Coach by typing <strong>@coach</strong> followed by their question.
            <br />
            Examples: "@coach who scored last?", "@coach injury report", "@coach 2019 championship"
          </AlertDescription>
        </Alert>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button 
            onClick={handleTest} 
            disabled={testing || !isEnabled}
            variant="outline"
            className="flex-1"
          >
            <TestTube className="mr-2 h-4 w-4" />
            {testing ? 'Testing...' : 'Test Coach'}
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={saving}
            className="flex-1"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
