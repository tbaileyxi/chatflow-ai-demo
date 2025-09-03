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
import { LazyEmbed } from '@/components/chat/LazyEmbed';

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
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
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

      // Create post for team feed and spotlight
      const postData = {
        author_id: user.id,
        team_id: item.team_id,
        content: `Trending: ${item.content}`,
        embed_code: item.embed_url,
        message_type: 'embed',
        is_spotlight: true,
        target_audience: ['team_feed', 'spotlight'],
        delivery_status: 'sent'
      };

      const { error: postError } = await supabase
        .from('posts')
        .insert(postData);

      if (postError) throw postError;

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
        description: "Post broadcasted to team feed and spotlight",
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
                        <LazyEmbed>
                          <XPostEmbed embedCode={item.embed_url} />
                        </LazyEmbed>
                      </div>
                      
                      {activeTab === 'pending' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleBroadcast(item)}
                            className="bg-gradient-to-r from-blue-600 to-purple-600"
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