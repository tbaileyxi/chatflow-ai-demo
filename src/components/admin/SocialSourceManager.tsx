import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, ExternalLink } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface Team {
  id: string;
  name: string;
  city: string;
}

interface SocialSource {
  id: string;
  team_id: string;
  source_type: string;
  source_url: string;
  is_active: boolean;
  created_at: string;
  teams?: Team;
}

export const SocialSourceManager = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [sources, setSources] = useState<SocialSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newSource, setNewSource] = useState({
    team_id: '',
    source_url: '',
    source_type: 'x_list'
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch teams
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('id, name, city')
        .eq('status', 'active')
        .order('name');

      if (teamsError) throw teamsError;
      setTeams(teamsData || []);

      // Fetch social sources
      const { data: sourcesData, error: sourcesError } = await supabase
        .from('social_sources')
        .select('*, teams(id, name, city)')
        .order('created_at', { ascending: false });

      if (sourcesError) throw sourcesError;
      setSources(sourcesData || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to fetch data: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSource.team_id || !newSource.source_url) {
      toast({
        title: "Error",
        description: "Please select a team and enter a source URL",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('social_sources')
        .insert({
          ...newSource,
          created_by: user.id
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Social source added successfully",
      });

      setNewSource({ team_id: '', source_url: '', source_type: 'x_list' });
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to add source: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('social_sources')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
      
      setSources(sources.map(source => 
        source.id === id ? { ...source, is_active: isActive } : source
      ));
      
      toast({
        title: "Success",
        description: `Source ${isActive ? 'activated' : 'deactivated'}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to update source: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const handleDeleteSource = async (id: string) => {
    if (!confirm('Are you sure you want to delete this source?')) return;
    
    try {
      const { error } = await supabase
        .from('social_sources')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setSources(sources.filter(source => source.id !== id));
      toast({
        title: "Success",
        description: "Source deleted successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to delete source: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const triggerIngestion = async () => {
    try {
      setIsSubmitting(true);
      const { data, error } = await supabase.functions.invoke('ingest-x-sources');
      
      if (error) throw error;
      
      toast({
        title: "Success",
        description: `Ingestion completed. Processed ${data.total_processed} tweets.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to trigger ingestion: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div>Loading social sources...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add Social Source</CardTitle>
          <CardDescription>
            Add X Lists to automatically fetch content for teams
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddSource} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="team">Team</Label>
                <Select 
                  value={newSource.team_id} 
                  onValueChange={(value) => setNewSource({...newSource, team_id: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.city} {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="url">X List URL</Label>
                <Input
                  value={newSource.source_url}
                  onChange={(e) => setNewSource({...newSource, source_url: e.target.value})}
                  placeholder="https://x.com/i/lists/123456789"
                />
              </div>
              
              <div className="flex items-end">
                <Button type="submit" disabled={isSubmitting}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Source
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Active Sources</CardTitle>
            <CardDescription>
              Manage X Lists for content ingestion
            </CardDescription>
          </div>
          <Button onClick={triggerIngestion} disabled={isSubmitting}>
            Fetch Content Now
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sources.map((source) => (
              <div key={source.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">
                      {source.teams?.city} {source.teams?.name}
                    </Badge>
                    <Badge variant={source.is_active ? "default" : "secondary"}>
                      {source.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{source.source_url}</span>
                    <ExternalLink 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => window.open(source.source_url, '_blank')}
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Switch
                    checked={source.is_active}
                    onCheckedChange={(checked) => handleToggleActive(source.id, checked)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteSource(source.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            
            {sources.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No social sources configured yet
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};