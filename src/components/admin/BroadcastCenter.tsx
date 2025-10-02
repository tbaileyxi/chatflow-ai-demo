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
import { Send, Clock, Link, CheckCircle, AlertCircle, Loader2, X, Calendar, Plus } from 'lucide-react';
import { ScheduleDialog } from '@/components/ScheduleDialog';
import { PostManagement } from '@/components/PostManagement';
import { ScheduledBroadcastProcessor } from './ScheduledBroadcastProcessor';
import { FileUpload } from '@/components/FileUpload';

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
  const [addToHighlights, setAddToHighlights] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus[]>([]);
  const [showDeliveryStatus, setShowDeliveryStatus] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [tags, setTags] = useState('');
  
  // Message type and content states
  const [messageType, setMessageType] = useState<'text' | 'media' | 'poll' | 'embed'>('text');
  const [textContent, setTextContent] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaCaption, setMediaCaption] = useState('');
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [embedIntroduction, setEmbedIntroduction] = useState('');
  
  // Simplified embed system - just paste embed codes directly
  const [embedCodes, setEmbedCodes] = useState('');

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

  const parseEmbedCodes = (codes: string) => {
    if (!codes.trim()) return [];
    
    // Split by lines and filter out empty lines
    const lines = codes.split('\n').filter(line => line.trim());
    
    return lines.map(line => {
      const trimmed = line.trim();
      let embedType: string;
      let embedCode: string;
      
      // Detect embed type and normalize
      if (trimmed.includes('twitter.com') || trimmed.includes('x.com')) {
        embedType = 'x';
        // Extract tweet URL if it's just a URL
        const tweetMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/\w+\/status\/\d+/);
        embedCode = tweetMatch ? tweetMatch[0] : trimmed;
      } else if (trimmed.includes('youtube.com') || trimmed.includes('youtu.be')) {
        embedType = 'youtube';
        embedCode = trimmed;
      } else {
        embedType = 'iframe';
        embedCode = trimmed;
      }
      
      return {
        commentary: '',
        embed_code: embedCode,
        embed_type: embedType
      };
    });
  };

  const addPollOption = () => {
    setPollOptions([...pollOptions, '']);
  };

  const updatePollOption = (index: number, value: string) => {
    const newOptions = [...pollOptions];
    newOptions[index] = value;
    setPollOptions(newOptions);
  };

  const removePollOption = (index: number) => {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((_, i) => i !== index));
    }
  };

  const validateForm = (): string | null => {
    if (messageType === 'text' && !textContent.trim()) {
      return 'Please enter message content';
    }

    if (messageType === 'media') {
      if (!mediaFile) {
        return 'Please select a media file';
      }
      if (!mediaCaption.trim()) {
        return 'Please enter a caption for your media';
      }
    }

    if (messageType === 'poll') {
      if (!pollQuestion.trim()) {
        return 'Please enter a poll question';
      }
      const validOptions = pollOptions.filter(opt => opt.trim());
      if (validOptions.length < 2) {
        return 'Please provide at least 2 poll options';
      }
    }

    if (messageType === 'embed') {
      if (!embedCodes.trim()) {
        return 'Please enter embed codes';
      }
      if (!embedIntroduction.trim()) {
        return 'Please enter an introduction for your thread';
      }
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
              is_team_agent_message: postData.is_team_agent_message || false,
              message_type: postData.message_type || null
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
      // Create content based on message type
      let finalContent = '';
      let pollData = null;
      let mediaUrl = null;
      let threadEmbeds = null;

      if (messageType === 'text') {
        finalContent = textContent;
      } else if (messageType === 'media' && mediaFile) {
        // Upload media file to Supabase storage
        const fileExt = mediaFile.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `broadcast/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('broadcast-media')
          .upload(filePath, mediaFile);

        if (uploadError) {
          throw new Error(`Media upload failed: ${uploadError.message}`);
        }

        const { data: { publicUrl } } = supabase.storage
          .from('broadcast-media')
          .getPublicUrl(filePath);

        mediaUrl = publicUrl;
        finalContent = mediaCaption;
      } else if (messageType === 'poll') {
        finalContent = pollQuestion;
        pollData = {
          question: pollQuestion,
          options: pollOptions.filter(opt => opt.trim()).map((option, index) => ({
            id: index,
            text: option.trim()
          }))
        };
      } else if (messageType === 'embed') {
        finalContent = embedIntroduction;
        threadEmbeds = parseEmbedCodes(embedCodes);
      }
      
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
              message_type: messageType === 'embed' ? 'embed' : 'text',
              is_agent_post: true,
              is_spotlight: true,
              poll_data: pollData,
              media_url: mediaUrl,
              embed_code: null,
              embeds: threadEmbeds,
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
          message_type: messageType === 'embed' ? 'embed' : 'text',
          is_agent_post: true,
          poll_data: pollData,
          media_url: mediaUrl,
          embed_code: null,
          embeds: threadEmbeds,
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
            message_type: messageType === 'embed' ? 'embed' : 'text',
            is_agent_post: true,
            poll_data: pollData,
            media_url: mediaUrl,
            embed_code: null,
            embeds: threadEmbeds,
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
          message_type: messageType === 'embed' ? 'embed' : 'text',
          is_agent_post: true,
          poll_data: pollData,
          media_url: mediaUrl,
          embed_code: null,
          embeds: threadEmbeds,
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
      setTextContent('');
      setMediaCaption('');
      setEmbedIntroduction('');
      setEmbedCodes('');
      setPollQuestion('');
      setPollOptions(['', '']);
      setMediaFile(null);
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

          {/* Message Type and Content */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="w-5 h-5" />
                Broadcast Message
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="message-type">Message Type</Label>
                <Select value={messageType} onValueChange={(value: 'text' | 'media' | 'poll' | 'embed') => setMessageType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text Message</SelectItem>
                    <SelectItem value="media">Media Upload</SelectItem>
                    <SelectItem value="poll">Poll</SelectItem>
                    <SelectItem value="embed">Embed Thread</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {messageType === 'text' && (
                <div className="space-y-2">
                  <Label htmlFor="text-content">Message Content</Label>
                  <Textarea
                    id="text-content"
                    placeholder="Enter your message..."
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>
              )}

              {messageType === 'media' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="media-file">Media File</Label>
                    <input
                      id="media-file"
                      type="file"
                      accept="image/*,video/*"
                      onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    {mediaFile && (
                      <p className="text-sm text-muted-foreground">Selected: {mediaFile.name}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="media-caption">Media Caption</Label>
                    <Textarea
                      id="media-caption"
                      placeholder="Enter caption for your media..."
                      value={mediaCaption}
                      onChange={(e) => setMediaCaption(e.target.value)}
                      className="min-h-[100px]"
                    />
                  </div>
                </div>
              )}

              {messageType === 'poll' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="poll-question">Poll Question</Label>
                    <Textarea
                      id="poll-question"
                      placeholder="Enter your poll question..."
                      value={pollQuestion}
                      onChange={(e) => setPollQuestion(e.target.value)}
                      className="min-h-[80px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Poll Options</Label>
                    {pollOptions.map((option, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={option}
                          onChange={(e) => updatePollOption(index, e.target.value)}
                          placeholder={`Option ${index + 1}`}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        />
                        {pollOptions.length > 2 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removePollOption(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addPollOption}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Option
                    </Button>
                  </div>
                </div>
              )}

              {messageType === 'embed' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="thread-intro">Thread Introduction</Label>
                    <Textarea
                      id="thread-intro"
                      placeholder="Introduce your thread with context..."
                      value={embedIntroduction}
                      onChange={(e) => setEmbedIntroduction(e.target.value)}
                      className="min-h-[80px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="embed-codes">Paste Embed Codes or URLs</Label>
                    <Textarea
                      id="embed-codes"
                      placeholder="Paste X post URLs, YouTube URLs, or embed codes (one per line)..."
                      value={embedCodes}
                      onChange={(e) => setEmbedCodes(e.target.value)}
                      className="min-h-[120px] font-mono text-sm"
                    />
                    <div className="text-xs text-muted-foreground">
                      Each line will become a separate embed in your thread. Supports X/Twitter posts, YouTube videos, and other embeddable content.
                    </div>
                  </div>
                </div>
              )}

              {/* Preview of what will be posted */}
              {messageType === 'embed' && embedCodes.trim() && (
                <div className="space-y-2">
                  <Label>Embed Preview:</Label>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {parseEmbedCodes(embedCodes).map((embed, index) => (
                      <div key={index} className="flex items-start justify-between p-3 border rounded-lg bg-muted/30">
                        <div className="flex-1">
                          <div className="text-xs text-muted-foreground">
                            {embed.embed_type === 'x' ? '📱 X Post' : 
                             embed.embed_type === 'youtube' ? '🎥 YouTube Video' : '🔗 Custom Embed'}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 truncate">
                            {embed.embed_code.substring(0, 80)}...
                          </div>
                        </div>
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
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="highlights"
                  checked={addToHighlights}
                  onCheckedChange={setAddToHighlights}
                />
                <Label htmlFor="highlights">Add to Highlights Board</Label>
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
              disabled={loading || 
                (messageType === 'text' && !textContent.trim()) || 
                (messageType === 'media' && (!mediaFile || !mediaCaption.trim())) ||
                (messageType === 'poll' && (!pollQuestion.trim() || pollOptions.filter(opt => opt.trim()).length < 2)) ||
                (messageType === 'embed' && (!embedCodes.trim() || !embedIntroduction.trim()))}
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
              disabled={loading || 
                (messageType === 'text' && !textContent.trim()) || 
                (messageType === 'media' && (!mediaFile || !mediaCaption.trim())) ||
                (messageType === 'poll' && (!pollQuestion.trim() || pollOptions.filter(opt => opt.trim()).length < 2)) ||
                (messageType === 'embed' && (!embedCodes.trim() || !embedIntroduction.trim()))}
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