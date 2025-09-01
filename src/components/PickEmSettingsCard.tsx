import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Trophy, Settings, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PickEmSettingsCardProps {
  huddleId: string;
  isOwner: boolean;
}

interface PickEmSettings {
  id?: string;
  is_enabled: boolean;
  league: string;
  auto_create_weekly: boolean;
  max_games: number;
}

export const PickEmSettingsCard = ({ huddleId, isOwner }: PickEmSettingsCardProps) => {
  const [settings, setSettings] = useState<PickEmSettings>({
    is_enabled: false,
    league: 'ncaa',
    auto_create_weekly: false,
    max_games: 10
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
  }, [huddleId]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('huddle_pickem_settings')
        .select('*')
        .eq('huddle_id', huddleId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error('Error fetching Pick\'em settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!isOwner) return;
    
    setSaving(true);
    try {
      const payload = {
        huddle_id: huddleId,
        is_enabled: settings.is_enabled,
        league: settings.league,
        auto_create_weekly: settings.auto_create_weekly,
        max_games: settings.max_games
      };

      if (settings.id) {
        const { error } = await supabase
          .from('huddle_pickem_settings')
          .update(payload)
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('huddle_pickem_settings')
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        setSettings(prev => ({ ...prev, id: data.id }));
      }

      toast({
        title: "Settings Saved",
        description: "Pick 'Em settings have been updated successfully.",
      });
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof PickEmSettings>(key: K, value: PickEmSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-white/10">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            <CardTitle>Pick 'Em Settings</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-10 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-white/10">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            <CardTitle>Pick 'Em Settings</CardTitle>
          </div>
          {settings.is_enabled && (
            <Badge variant="secondary" className="text-xs">
              <Calendar className="h-3 w-3 mr-1" />
              Active
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable Pick 'Em */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="enable-pickem">Enable Pick 'Em</Label>
            <p className="text-xs text-muted-foreground">
              Allow members to participate in weekly Pick 'Em games
            </p>
          </div>
          <Switch
            id="enable-pickem"
            checked={settings.is_enabled}
            onCheckedChange={(checked) => updateSetting('is_enabled', checked)}
            disabled={!isOwner}
          />
        </div>

        {settings.is_enabled && (
          <>
            {/* League Selection */}
            <div className="space-y-2">
              <Label htmlFor="league">League</Label>
              <Select
                value={settings.league}
                onValueChange={(value) => updateSetting('league', value)}
                disabled={!isOwner}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select league" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ncaa">NCAA Football</SelectItem>
                  <SelectItem value="nfl">NFL</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Auto-create Weekly */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="auto-create">Auto-create Weekly</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically create Pick 'Em games every Tuesday
                </p>
              </div>
              <Switch
                id="auto-create"
                checked={settings.auto_create_weekly}
                onCheckedChange={(checked) => updateSetting('auto_create_weekly', checked)}
                disabled={!isOwner}
              />
            </div>

            {/* Max Games */}
            <div className="space-y-2">
              <Label htmlFor="max-games">Max Games per Week</Label>
              <Select
                value={settings.max_games.toString()}
                onValueChange={(value) => updateSetting('max_games', parseInt(value))}
                disabled={!isOwner}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 Games</SelectItem>
                  <SelectItem value="10">10 Games</SelectItem>
                  <SelectItem value="15">15 Games</SelectItem>
                  <SelectItem value="20">20 Games</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isOwner && (
              <Button 
                onClick={saveSettings} 
                disabled={saving}
                className="w-full"
              >
                <Settings className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            )}
          </>
        )}

        {!settings.is_enabled && isOwner && (
          <Button 
            onClick={saveSettings} 
            disabled={saving}
            className="w-full"
          >
            <Settings className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        )}

        {!isOwner && (
          <p className="text-xs text-muted-foreground text-center">
            Only huddle owners can modify Pick 'Em settings
          </p>
        )}
      </CardContent>
    </Card>
  );
};