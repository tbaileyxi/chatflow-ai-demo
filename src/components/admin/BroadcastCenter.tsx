import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Send, Clock, Link, CheckCircle, AlertCircle, Loader2, X, Calendar } from 'lucide-react';
import { ScheduleDialog } from '@/components/ScheduleDialog';
import { PostManagement } from '@/components/PostManagement';
import { ScheduledBroadcastProcessor } from './ScheduledBroadcastProcessor';

interface Team {
  id: string;
  name: string;
  city: string;
  league: string;
}

interface DeliveryStatus {
  channel: string;
  status: 'pending' | 'delivered' | 'failed';
  error?: string;
}

export const BroadcastCenter = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [sourceTeam, setSourceTeam] = useState('');
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [addToSpotlight, setAddToSpotlight] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus[]>([]);
  const [showDeliveryStatus, setShowDeliveryStatus] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [tags, setTags] = useState('');
  
  // Simple embed system - like X/Twitter
  const [embedList, setEmbedList] = useState<Array<{ commentary: string; embed_code: string; embed_type: 'x' | 'iframe' | 'youtube' }>>([]);
  const [currentEmbedCode, setCurrentEmbedCode] = useState('');
  const [currentEmbedCommentary, setCurrentEmbedCommentary] = useState('');

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, city, league')
        .order('league', { ascending: true })
        .order('city', { ascending: true });

      if (error) throw error;
      setTeams(data || []);
    } catch (error) {
      console.error('Error fetching teams:', error);
      toast({
        title: "Error",
        description: "Failed to load teams",
        variant: "destructive"
      });
    }
  };

  const addEmbed = () => {
    if (!currentEmbedCode.trim()) {
      toast({
        title: "Error",
        description: "Please enter embed code first",
        variant: "destructive"
      });
      return;
    }

    const embedType = currentEmbedCode.includes('twitter.com') || currentEmbedCode.includes('x.com') ? 'x' :
                     currentEmbedCode.includes('youtube.com') || currentEmbedCode.includes('youtu.be') ? 'youtube' : 'iframe';

    setEmbedList(prev => [...prev, {
      commentary: currentEmbedCommentary.trim(),
      embed_code: currentEmbedCode,
      embed_type: embedType
    }]);

    // Clear form
    setCurrentEmbedCode('');
    setCurrentEmbedCommentary('');
  };

  const removeEmbed = (index: number) => {
    setEmbedList(prev => prev.filter((_, i) => i !== index));
  };

  const validateForm = (): string | null => {
    if (embedList.length === 0) {
      return 'Please add at least one embed';
    }

    if (!sourceTeam) {
      return 'Please select a source team';
    }

    if (selectedTeams.length === 0) {
      return 'Please select at least one destination team';
    }

    if (!user?.id) {
      return 'You must be logged in to send messages';
    }

    return null;
  };

  const broadcastToHuddles = async (postData: any, teamIds: string[]) => {
    try {
      // Get all huddles for the selected teams
      const { data: huddles, error: huddlesError } = await supabase
        .from('huddles')
        .select('id, name, team_id')
        .in('team_id', teamIds);

      if (huddlesError) throw huddlesError;

      // Create actual huddle messages for each huddle
      let hadError = false;
      let firstError = "";
      if (huddles?.length) {
        for (const huddle of huddles) {
          const { error } = await supabase
            .from('huddle_messages')
            .insert({
              content: postData.content,
              huddle_id: huddle.id,
              user_id: postData.author_id,
              origin_team_id: postData.origin_team_id,
              origin_post_id: postData.post_id,
              media_url: postData.media_url,
              media_type: postData.media_url ? 
                (postData.media_url.includes('.mp4') || postData.media_url.includes('.mov') || postData.media_url.includes('.webm') || postData.media_url.includes('.avi') ? 'video' : 'image') 
                : 'text',
              embed_code: postData.embed_code,
              embeds: postData.embeds,
              poll_data: postData.poll_data,
              is_team_agent_message: postData.is_team_agent_message || false
            });

          if (error) {
            console.error(`Failed to broadcast to huddle ${huddle.name}:`, error);
            if (!firstError) firstError = `Failed to broadcast to huddle: ${huddle.name}`;
            hadError = true;
            continue;
          }
        }
      }

      return hadError ? { success: false, error: firstError } : { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const handleSendMessage = async () => {
    const validationError = validateForm();
    if (validationError) {
      toast({
        title: "Validation Error",
        description: validationError,
        variant: "destructive"
      });
      return;
    }

    // Prevent double submission
    if (loading) return;

    setLoading(true);
    setDeliveryStatus([]);
    setShowDeliveryStatus(true);

    try {
      // Simple broadcast system: Just send embeds
      const finalContent = '';
      
      // New broadcast system: Single post from source team that gets distributed
      const deliveryResults: DeliveryStatus[] = [];
      const sourceTeamInfo = teams.find(t => t.id === sourceTeam);
      const sourceTeamName = sourceTeamInfo ? `${sourceTeamInfo.city} ${sourceTeamInfo.name}` : 'Source Team';

      try {
        // Get system bot user for broadcast posts
        const { data: systemBot } = await supabase.rpc('get_or_create_system_user');
        const systemBotId = systemBot || user.id;

        // Create the main spotlight post if enabled (only for source team)
        if (addToSpotlight) {
          const spotlightData = {
            content: finalContent,
            team_id: sourceTeam,
            origin_team_id: sourceTeam,
            author_id: systemBotId,
            message_type: 'embed',
            is_agent_post: true,
            is_spotlight: true,
            poll_data: null,
            media_url: null,
            embed_code: null,
            embeds: embedList,
            target_audience: ['spotlight'],
            delivery_status: 'sent'
          };

          // Add tags if provided
          if (tags.trim()) {
            spotlightData.content += ` ${tags.split(',').map(tag => `#${tag.trim()}`).join(' ')}`;
          }

          const { data: spotlightPost, error: spotlightError } = await supabase
            .from('posts')
            .insert(spotlightData)
            .select()
            .single();

          if (spotlightError) {
            console.error('Spotlight post error:', spotlightError);
            deliveryResults.push({
              channel: 'Spotlight Feed',
              status: 'failed',
              error: spotlightError.message
            });
          } else {
            deliveryResults.push({
              channel: 'Spotlight Feed',
              status: 'delivered'
            });
          }
        }

        // Create team feed posts for source and destination teams
        const targetAudience = ['team_feed'];
        
        const postData = {
          content: finalContent,
          team_id: sourceTeam,
          origin_team_id: sourceTeam,
          author_id: systemBotId,
          message_type: 'embed',
          is_agent_post: true,
          poll_data: null,
          media_url: null,
          embed_code: null,
          embeds: embedList,
          target_audience: targetAudience,
          delivery_status: 'sent',
          is_spotlight: false
        };

        // Add tags if provided
        if (tags.trim()) {
          postData.content += ` ${tags.split(',').map(tag => `#${tag.trim()}`).join(' ')}`;
        }

        const { data: createdPost, error: postError } = await supabase
          .from('posts')
          .insert(postData)
          .select()
          .single();

        if (postError) throw postError;

        deliveryResults.push({
          channel: `${sourceTeamName} - Team Feed`,
          status: 'delivered'
        });

        if (addToSpotlight) {
          deliveryResults.push({
            channel: 'Spotlight Feed',
            status: 'delivered'
          });
        }

        // Create additional posts for destination team feeds (not spotlight)
        for (const destTeamId of selectedTeams) {
          const feedPostData = {
            content: tags.trim() ? `${finalContent} ${tags.split(',').map(tag => `#${tag.trim()}`).join(' ')}` : finalContent,
            team_id: destTeamId,
            origin_team_id: sourceTeam,
            author_id: systemBotId,
            message_type: 'embed',
            is_agent_post: true,
            poll_data: null,
            media_url: null,
            embed_code: null,
            embeds: embedList,
            target_audience: ['team_feed'],
            delivery_status: 'sent',
            is_spotlight: false
          };

          const { error: feedError } = await supabase
            .from('posts')
            .insert(feedPostData);

          const destTeamInfo = teams.find(t => t.id === destTeamId);
          const destTeamName = destTeamInfo ? `${destTeamInfo.city} ${destTeamInfo.name}` : 'Team';

          deliveryResults.push({
            channel: `${destTeamName} - Team Feed`,
            status: feedError ? 'failed' : 'delivered',
            error: feedError?.message
          });
        }

        // Broadcast to all destination teams' huddles (including source team)
        const allTargetTeams = Array.from(new Set([sourceTeam, ...selectedTeams]));
        const huddleContent = tags.trim() ? `${finalContent} ${tags.split(',').map(tag => `#${tag.trim()}`).join(' ')}` : finalContent;
        
        const huddlePostData = {
          content: huddleContent,
          team_id: sourceTeam,
          origin_team_id: sourceTeam,
          author_id: systemBotId,
          message_type: 'embed',
          is_agent_post: true,
          poll_data: null,
          media_url: null,
          embed_code: null,
          embeds: embedList,
          is_team_agent_message: true,
          post_id: createdPost.id
        };
        
        console.log('Broadcasting to huddles with data:', huddlePostData);
        const huddleResult = await broadcastToHuddles(huddlePostData, allTargetTeams);

        // Add delivery status for each team's huddles
        for (const teamId of allTargetTeams) {
          const teamInfo = teams.find(t => t.id === teamId);
          const teamName = teamInfo ? `${teamInfo.city} ${teamInfo.name}` : 'Team';
          
          deliveryResults.push({
            channel: `${teamName} - All Huddles`,
            status: huddleResult.success ? 'delivered' : 'failed',
            error: huddleResult.error
          });
        }

      } catch (error: any) {
        deliveryResults.push({
          channel: `${sourceTeamName} - Broadcast`,
          status: 'failed',
          error: error.message
        });
      }

      setDeliveryStatus(deliveryResults);

      const successCount = deliveryResults.filter(r => r.status === 'delivered').length;
      const failureCount = deliveryResults.filter(r => r.status === 'failed').length;

      if (successCount > 0) {
        toast({
          title: "Broadcast Complete",
          description: `Delivered to ${successCount} channel${successCount > 1 ? 's' : ''}${failureCount > 0 ? ` (${failureCount} failed)` : ''}`,
        });
      }

      // Clear form on success
      setCurrentEmbedCode('');
      setCurrentEmbedCommentary('');
      setEmbedList([]);
      setTags('');

    } catch (error: any) {
      console.error('Error sending broadcast:', error);
      toast({
        title: "Error",
        description: "Failed to send broadcast",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleBroadcast = async (scheduledDate: Date) => {
    const validationError = validateForm();
    if (validationError) {
      toast({
        title: "Validation Error",
        description: validationError,
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Coming Soon",
      description: "Scheduling feature will be available soon!",
    });
    setScheduleDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <ScheduledBroadcastProcessor />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Broadcast Form */}
        <div className="space-y-6">
          {/* Source Team Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Source Team</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={sourceTeam} onValueChange={setSourceTeam}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.city} {team.name} ({team.league})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Destination Teams */}
          <Card>
            <CardHeader>
              <CardTitle>Destination Teams</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {teams.map((team) => (
                  <div key={team.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={team.id}
                      checked={selectedTeams.includes(team.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTeams(prev => [...prev, team.id]);
                        } else {
                          setSelectedTeams(prev => prev.filter(id => id !== team.id));
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor={team.id} className="text-sm">
                      {team.city} {team.name} ({team.league})
                    </Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Simple Embed Interface */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link className="w-5 h-5" />
                Broadcast Embeds
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="embed-code">Paste embed code or URL</Label>
                <Textarea
                  id="embed-code"
                  placeholder="Paste X post URL, YouTube URL, or embed code..."
                  value={currentEmbedCode}
                  onChange={(e) => setCurrentEmbedCode(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="embed-commentary">Add text/commentary (optional)</Label>
                <Textarea
                  id="embed-commentary"
                  placeholder="Add your text or commentary for this embed..."
                  value={currentEmbedCommentary}
                  onChange={(e) => setCurrentEmbedCommentary(e.target.value)}
                  className="min-h-[60px]"
                />
              </div>

              <Button 
                type="button" 
                variant="outline" 
                onClick={addEmbed}
                className="w-full"
                disabled={!currentEmbedCode.trim()}
              >
                Add Another Embed
              </Button>

              {/* Preview of what will be posted */}
              {embedList.length > 0 && (
                <div className="space-y-2">
                  <Label>What will be posted:</Label>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {embedList.map((embed, index) => (
                      <div key={index} className="flex items-start justify-between p-3 border rounded-lg bg-muted/30">
                        <div className="flex-1">
                          {embed.commentary && (
                            <div className="text-sm mb-2 font-medium">
                              {embed.commentary}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            {embed.embed_type === 'x' ? '📱 X Post' : 
                             embed.embed_type === 'youtube' ? '🎥 YouTube Video' : '🔗 Custom Embed'}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 truncate">
                            {embed.embed_code.substring(0, 80)}...
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeEmbed(index)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Optional Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="spotlight"
                  checked={addToSpotlight}
                  onCheckedChange={setAddToSpotlight}
                />
                <Label htmlFor="spotlight">Add to Spotlight Feed</Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <input
                  id="tags"
                  type="text"
                  placeholder="tag1, tag2, tag3"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md"
                />
              </div>
            </CardContent>
          </Card>

          {/* Send Buttons */}
          <div className="flex gap-3">
            <Button 
              onClick={handleSendMessage} 
              disabled={loading || embedList.length === 0}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Now
                </>
              )}
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => setScheduleDialogOpen(true)}
              disabled={loading || embedList.length === 0}
            >
              <Clock className="w-4 h-4 mr-2" />
              Schedule
            </Button>
          </div>
        </div>

        {/* Status and Management */}
        <div className="space-y-6">
          {/* Delivery Status */}
          {showDeliveryStatus && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="w-5 h-5" />
                  Delivery Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {deliveryStatus.map((status, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded">
                      <span className="text-sm">{status.channel}</span>
                      <div className="flex items-center gap-2">
                        {status.status === 'delivered' && (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        )}
                        {status.status === 'failed' && (
                          <AlertCircle className="w-4 h-4 text-red-600" />
                        )}
                        {status.status === 'pending' && (
                          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                        )}
                        <Badge 
                          variant={status.status === 'delivered' ? 'default' : 
                                  status.status === 'failed' ? 'destructive' : 'secondary'}
                        >
                          {status.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Post Management */}
          <PostManagement />
        </div>
      </div>

      {/* Schedule Dialog */}
      <ScheduleDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        onSchedule={handleScheduleBroadcast}
        loading={loading}
      />
    </div>
  );
};