import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, XCircle, Send, Star, ExternalLink } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { XPostEmbed } from '@/components/embeds/XPostEmbed';
import { Checkbox } from '@/components/ui/checkbox';

interface TeamTrending {
  id: string;
  team_id: string;
  post_id: string;
  embed_url: string;
  content: string;
  author_username: string;
  likes: number;
  retweets: number;
  replies: number;
  rank_score: number;
  status: string;
  created_at: string;
  teams?: {
    id: string;
    name: string;
    city: string;
  };
}

export const CurationQueue = () => {
  const [trending, setTrending] = useState<TeamTrending[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [teams, setTeams] = useState<any[]>([]);
  const [huddles, setHuddles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedDestinations, setSelectedDestinations] = useState({
    spotlight: true,
    teamFeed: true,
    huddles: [] as string[]
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, [selectedTeam, activeTab]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch teams for filter
      const { data: teamsData } = await supabase
        .from('teams')
        .select('id, name, city')
        .eq('status', 'active')
        .order('name');
      
      setTeams(teamsData || []);

      // Fetch huddles for broadcast destination selection
      const { data: huddlesData } = await supabase
        .from('huddles')
        .select('id, name, team_id, teams(name, city)')
        .eq('is_private', false)
        .order('name');
      
      setHuddles(huddlesData || []);

      // Build query
      let query = supabase
        .from('team_trending')
        .select('*, teams(id, name, city)')
        .eq('status', activeTab)
        .order('rank_score', { ascending: false })
        .limit(50);

      if (selectedTeam && selectedTeam !== 'all') {
        query = query.eq('team_id', selectedTeam);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      setTrending(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to fetch trending posts: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('team_trending')
        .update({ 
          status,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      
      setTrending(trending.filter(item => item.id !== id));
      toast({
        title: "Success",
        description: `Post ${status}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to update status: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const handleBroadcast = async (item: TeamTrending) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const broadcasts = [];

      // Normalize embed URL to ensure it's a twitter.com URL for proper embedding
      const normalizedEmbedUrl = item.embed_url.replace('x.com', 'twitter.com');

      // Broadcast to Spotlight
      if (selectedDestinations.spotlight) {
        const spotlightData = {
          author_id: user.id,
          team_id: item.team_id,
          content: item.content,
          embed_code: normalizedEmbedUrl,
          message_type: 'embed',
          is_spotlight: true,
          is_agent_post: true,
          is_team_agent_message: true,
          origin_team_id: item.team_id,
          target_audience: ['spotlight'],
          delivery_status: 'sent'
        };

        const { error: spotlightError } = await supabase
          .from('posts')
          .insert(spotlightData);

        if (spotlightError) throw spotlightError;
        broadcasts.push('Spotlight');
      }

      // Broadcast to Team Feed
      if (selectedDestinations.teamFeed) {
        const teamFeedData = {
          author_id: user.id,
          team_id: item.team_id,
          content: item.content,
          embed_code: normalizedEmbedUrl,
          message_type: 'embed',
          is_spotlight: false,
          is_agent_post: true,
          is_team_agent_message: true,
          origin_team_id: item.team_id,
          target_audience: ['team_feed'],
          delivery_status: 'sent'
        };

        const { error: teamFeedError } = await supabase
          .from('posts')
          .insert(teamFeedData);

        if (teamFeedError) throw teamFeedError;
        broadcasts.push('Team Feed');
      }

      // Broadcast to selected Huddles
      for (const huddleId of selectedDestinations.huddles) {
        const huddleMessageData = {
          huddle_id: huddleId,
          user_id: user.id,
          content: item.content,
          embed_code: normalizedEmbedUrl,
          media_type: 'embed',
          is_team_agent_message: true,
          origin_team_id: item.team_id
        };

        const { error: huddleError } = await supabase
          .from('huddle_messages')
          .insert(huddleMessageData);

        if (huddleError) throw huddleError;
        
        const huddle = huddles.find(h => h.id === huddleId);
        if (huddle) {
          broadcasts.push(huddle.name);
        }
      }

      // Update trending status
      const { error: updateError } = await supabase
        .from('team_trending')
        .update({ 
          status: 'broadcasted',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', item.id);

      if (updateError) throw updateError;
      
      setTrending(trending.filter(t => t.id !== item.id));
      toast({
        title: "Success",
        description: `Post broadcasted to: ${broadcasts.join(', ')}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to broadcast: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return <div>Loading curation queue...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Content Curation Queue</CardTitle>
          <CardDescription>
            Review and approve trending content for broadcasting
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Teams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.city} {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="pending">Pending Review</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
              <TabsTrigger value="broadcasted">Broadcasted</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-6">
              <div className="space-y-6">
                {trending.map((item) => (
                  <Card key={item.id} className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {item.teams?.city} {item.teams?.name}
                          </Badge>
                          <Badge variant="secondary">
                            <Star className="h-3 w-3 mr-1" />
                            {item.rank_score}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            @{item.author_username}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>👍 {item.likes}</span>
                          <span>🔄 {item.retweets}</span>
                          <span>💬 {item.replies}</span>
                          <ExternalLink 
                            className="h-4 w-4 cursor-pointer ml-2" 
                            onClick={() => window.open(item.embed_url, '_blank')}
                          />
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent>
                      <div className="mb-4">
                        <div className="bg-muted/50 rounded-lg p-4">
                          <XPostEmbed embedCode={item.embed_url} />
                        </div>
                      </div>
                      
                      {activeTab === 'pending' && (
                        <div className="space-y-4">
                          {/* Broadcast Destinations */}
                          <div className="border rounded-lg p-4 bg-muted/50">
                            <h4 className="text-sm font-medium mb-3">Broadcast to:</h4>
                            <div className="space-y-2">
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id={`spotlight-${item.id}`}
                                  checked={selectedDestinations.spotlight}
                                  onCheckedChange={(checked) => 
                                    setSelectedDestinations(prev => ({ ...prev, spotlight: !!checked }))
                                  }
                                />
                                <label htmlFor={`spotlight-${item.id}`} className="text-sm">Spotlight</label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id={`teamfeed-${item.id}`}
                                  checked={selectedDestinations.teamFeed}
                                  onCheckedChange={(checked) => 
                                    setSelectedDestinations(prev => ({ ...prev, teamFeed: !!checked }))
                                  }
                                />
                                <label htmlFor={`teamfeed-${item.id}`} className="text-sm">Team Feed</label>
                              </div>
                              {huddles.filter(h => h.team_id === item.team_id).map(huddle => (
                                <div key={huddle.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`huddle-${huddle.id}-${item.id}`}
                                    checked={selectedDestinations.huddles.includes(huddle.id)}
                                    onCheckedChange={(checked) => {
                                      setSelectedDestinations(prev => ({
                                        ...prev,
                                        huddles: checked 
                                          ? [...prev.huddles, huddle.id]
                                          : prev.huddles.filter(id => id !== huddle.id)
                                      }));
                                    }}
                                  />
                                  <label htmlFor={`huddle-${huddle.id}-${item.id}`} className="text-sm">{huddle.name}</label>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleBroadcast(item)}
                              className="bg-gradient-to-r from-blue-600 to-purple-600"
                              disabled={!selectedDestinations.spotlight && !selectedDestinations.teamFeed && selectedDestinations.huddles.length === 0}
                            >
                              <Send className="h-4 w-4 mr-2" />
                              Broadcast
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusChange(item.id, 'approved')}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Approve Only
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusChange(item.id, 'rejected')}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
                
                {trending.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No {activeTab} posts found
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};