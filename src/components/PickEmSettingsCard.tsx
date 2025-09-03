import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Trophy, Settings, Calendar, Download, Plus, Loader2 } from 'lucide-react';
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
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [syncForm, setSyncForm] = useState({
    league: 'ncaa',
    season_year: new Date().getFullYear(),
    week_number: 1
  });
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

  const handleSyncGames = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('pickem-sync', {
        body: syncForm
      });

      if (error) throw error;

      toast({
        title: "Games Synced",
        description: `Successfully synced ${syncForm.league.toUpperCase()} Week ${syncForm.week_number} games from ESPN`,
      });
      
      setSyncDialogOpen(false);
    } catch (error: any) {
      console.error('Error syncing games:', error);
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync games from ESPN",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateThisWeek = async () => {
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('pickem-autocreate', {
        body: { huddleId }
      });

      if (error) throw error;

      const result = data || {};
      if (result.created > 0) {
        toast({
          title: "Pick 'Em Created!",
          description: "This week's Pick 'Em has been created successfully",
        });
      } else {
        toast({
          title: "No Pick 'Em Created",
          description: result.message || "No new Pick 'Em was needed for this week",
        });
      }
    } catch (error: any) {
      console.error('Error creating Pick\'em:', error);
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create this week's Pick 'Em",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
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

        {/* League Selection - Always visible when enabled */}
        {settings.is_enabled && (
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
        )}

        {/* Max Games - Always visible when enabled */}
        {settings.is_enabled && (
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
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Auto-create Weekly - Optional setting */}
        {settings.is_enabled && (
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
        )}

        {/* Owner Actions */}
        {isOwner && settings.is_enabled && (
          <div className="space-y-3 pt-4 border-t border-border/50">
            <Label className="text-sm font-medium">Quick Actions</Label>
            
            <div className="grid grid-cols-1 gap-2">
              <Dialog open={syncDialogOpen} onOpenChange={setSyncDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Sync Games from ESPN
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Sync Games from ESPN</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>League</Label>
                      <Select 
                        value={syncForm.league} 
                        onValueChange={(value) => setSyncForm(prev => ({ ...prev, league: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ncaa">NCAA Football</SelectItem>
                          <SelectItem value="nfl">NFL</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Season Year</Label>
                      <Input
                        type="number"
                        value={syncForm.season_year}
                        onChange={(e) => setSyncForm(prev => ({ ...prev, season_year: parseInt(e.target.value) }))}
                        min={2020}
                        max={2030}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Week Number</Label>
                      <Input
                        type="number"
                        value={syncForm.week_number}
                        onChange={(e) => setSyncForm(prev => ({ ...prev, week_number: parseInt(e.target.value) }))}
                        min={1}
                        max={20}
                      />
                    </div>
                    
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setSyncDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleSyncGames} disabled={syncing}>
                        {syncing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Sync Games
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleCreateThisWeek}
                disabled={creating}
                className="w-full"
              >
                {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                Create This Week Now
              </Button>
            </div>
          </div>
        )}

        {/* Save Button - Always visible for owners */}
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


        {!isOwner && (
          <p className="text-xs text-muted-foreground text-center">
            Only huddle owners can modify Pick 'Em settings
          </p>
        )}
      </CardContent>
    </Card>
  );
};