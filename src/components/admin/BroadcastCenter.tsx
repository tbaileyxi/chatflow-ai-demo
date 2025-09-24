import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { MediaUpload } from '@/components/MediaUpload';
import { MediaViewer } from '@/components/MediaViewer';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Send, Clock, Upload, Link, MessageSquare, BarChart3, CheckCircle, AlertCircle, Loader2, X, Calendar } from 'lucide-react';
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
  const [messageType, setMessageType] = useState('text');
  const [content, setContent] = useState('');
  const [addToSpotlight, setAddToSpotlight] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [embedCode, setEmbedCode] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [mediaCommentary, setMediaCommentary] = useState('');
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus[]>([]);
  const [showDeliveryStatus, setShowDeliveryStatus] = useState(false);
  const [embedPreview, setEmbedPreview] = useState('');
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [tags, setTags] = useState('');
  
  // Simple embed list - like X/Twitter multiple embeds
  const [embedList, setEmbedList] = useState<Array<{ commentary: string; embed_code: string; embed_type: 'x' | 'iframe' | 'youtube' }>>([]);
  const [currentEmbedCommentary, setCurrentEmbedCommentary] = useState('');

  useEffect(() => {
    fetchTeams();
  }, []);

  // Generate embed preview when embed code changes
  useEffect(() => {
    if (embedCode.trim()) {
      generateEmbedPreview(embedCode);
    } else {
      setEmbedPreview('');
    }
  }, [embedCode]);

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

  const generateEmbedPreview = (code: string) => {
    // Extract common embed patterns
    if (code.includes('twitter.com') || code.includes('x.com')) {
      const urlMatch = code.match(/https?:\/\/(?:twitter\.com|x\.com)\/\w+\/status\/\d+/);
      if (urlMatch) {
        setEmbedPreview(`Twitter post: ${urlMatch[0]}`);
      }
    } else if (code.includes('youtube.com') || code.includes('youtu.be')) {
      const urlMatch = code.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
      if (urlMatch) {
        setEmbedPreview(`YouTube video: ${urlMatch[0]}`);
      }
    } else if (code.includes('instagram.com')) {
      const urlMatch = code.match(/https?:\/\/(?:www\.)?instagram\.com\/p\/[^\/]+/);
      if (urlMatch) {
        setEmbedPreview(`Instagram post: ${urlMatch[0]}`);
      }
    } else if (code.includes('<iframe')) {
      setEmbedPreview('Custom embed code detected');
    } else {
      setEmbedPreview('');
    }
  };

  const handleMediaWithCommentary = (url: string, type: 'image' | 'video', commentary?: string) => {
    setMediaUrl(url);
    setMediaType(type);
    if (commentary) {
      setMediaCommentary(commentary);
    }
  };

  const addPollOption = () => {
    setPollOptions(prev => [...prev, '']);
  };

  const updatePollOption = (index: number, value: string) => {
    setPollOptions(prev => prev.map((option, i) => i === index ? value : option));
  };

  const removePollOption = (index: number) => {
    if (pollOptions.length > 2) {
      setPollOptions(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleMediaSelected = (url: string, type: 'image' | 'video') => {
    setMediaUrl(url);
    setMediaType(type);
  };

  const clearMedia = () => {
    setMediaUrl('');
    setMediaType(null);
  };

  const addEmbed = () => {
    if (!embedCode.trim()) {
      toast({
        title: "Error",
        description: "Please enter embed code first",
        variant: "destructive"
      });
      return;
    }

    const embedType = embedCode.includes('twitter.com') || embedCode.includes('x.com') ? 'x' :
                     embedCode.includes('youtube.com') || embedCode.includes('youtu.be') ? 'youtube' : 'iframe';

    setEmbedList(prev => [...prev, {
      commentary: currentEmbedCommentary.trim(),
      embed_code: embedCode,
      embed_type: embedType
    }]);

    // Clear form
    setEmbedCode('');
    setEmbedPreview('');
    setCurrentEmbedCommentary('');
  };

  const removeEmbed = (index: number) => {
    setEmbedList(prev => prev.filter((_, i) => i !== index));
  };

  const validateForm = (): string | null => {
    if (!content.trim() && !mediaUrl && !mediaCommentary.trim() && messageType !== 'upload' && embedList.length === 0) {
      return 'Please enter message content, upload media, or add embeds';
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

    if (messageType === 'poll') {
      const validOptions = pollOptions.filter(option => option.trim());
      if (validOptions.length < 2) {
        return 'Poll must have at least 2 options';
      }
    }

    if (messageType === 'upload' && !mediaUrl) {
      return 'Please upload a file';
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
              origin_post_id: postData.post_id, // Link to the original post for cascade deletion
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
      let pollData = null;
      if (messageType === 'poll') {
        const validOptions = pollOptions.filter(option => option.trim());
        const pollId = crypto.randomUUID();
        pollData = {
          id: pollId,
          question: content,
          options: validOptions.map((option, index) => ({ 
            id: index, 
            text: option, 
            votes: 0 
          }))
        };
      }

      // Simplified broadcast system: Every message goes to Team Feed + All Team Huddles
      // Optional: Add to Spotlight Feed
      
      const finalContent = mediaCommentary.trim() || content || (messageType === 'upload' ? '' : '');
      
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
            author_id: systemBotId, // Use system bot for broadcast posts
            message_type: messageType,
            is_agent_post: true,
            is_spotlight: true,
            poll_data: pollData,
            media_url: messageType === 'upload' ? mediaUrl : null,
            embed_code: messageType === 'embed' && embedList.length === 0 ? embedCode : null,
            embeds: embedList.length > 0 ? embedList : null,
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
          team_id: sourceTeam, // The post belongs to the source team
          origin_team_id: sourceTeam, // Track the original source team
          author_id: systemBotId, // Use system bot for broadcast posts
          message_type: messageType,
          is_agent_post: true,
          poll_data: pollData,
          media_url: messageType === 'upload' ? mediaUrl : null,
          embed_code: messageType === 'embed' && embedList.length === 0 ? embedCode : null,
          embeds: embedList.length > 0 ? embedList : null,
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
            team_id: destTeamId, // Post appears in destination team's feed
            origin_team_id: sourceTeam, // But track the source team for attribution
            author_id: systemBotId, // Use system bot for broadcast posts
            message_type: messageType,
            is_agent_post: true,
            poll_data: pollData,
            media_url: messageType === 'upload' ? mediaUrl : null,
            embed_code: messageType === 'embed' && embedList.length === 0 ? embedCode : null,
            embeds: embedList.length > 0 ? embedList : null,
            target_audience: ['team_feed'], // Only team feed, no spotlight
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
        const allTargetTeams = Array.from(new Set([sourceTeam, ...selectedTeams])); // Remove duplicates
        const huddleContent = tags.trim() ? `${finalContent} ${tags.split(',').map(tag => `#${tag.trim()}`).join(' ')}` : finalContent;
        
        // Ensure embed_code is properly included for X video embeds
        const huddlePostData = {
          content: huddleContent,
          team_id: sourceTeam, // Keep source team context
          origin_team_id: sourceTeam, // Track the original source team
          author_id: systemBotId, // Use system bot for broadcast posts
          message_type: messageType,
          is_agent_post: true,
          poll_data: pollData,
          media_url: messageType === 'upload' ? mediaUrl : null,
          embed_code: messageType === 'embed' && embedList.length === 0 ? embedCode : null,
          embeds: embedList.length > 0 ? embedList : null,
          is_team_agent_message: true,
          post_id: createdPost.id // Include the post ID for linking
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
          variant: successCount === deliveryResults.length ? "default" : "destructive"
        });

        // Clear form on successful broadcast
        setContent('');
        setMediaUrl('');
        setMediaType(null);
        setMediaCommentary('');
        setEmbedCode('');
        setEmbedPreview('');
        setEmbedList([]);
        setCurrentEmbedCommentary('');
        setPollOptions(['', '']);
        setTags('');
        setSelectedTeams([]);
      } else {
        toast({
          title: "Broadcast Failed",
          description: "Failed to deliver to any channels",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('Broadcast error:', error);
      toast({
        title: "Broadcast Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleBroadcast = async (scheduledTime: Date) => {
    const validationError = validateForm();
    if (validationError) {
      toast({
        title: "Validation Error", 
        description: validationError,
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      let pollData = null;
      if (messageType === 'poll') {
        const validOptions = pollOptions.filter(option => option.trim());
        const pollId = crypto.randomUUID();
        pollData = {
          id: pollId,
          question: content,
          options: validOptions.map((option, index) => ({ 
            id: index, 
            text: option, 
            votes: 0 
          }))
        };
      }

      const finalContent = mediaCommentary.trim() || content || (messageType === 'upload' ? '' : '');

      // Create scheduled post
      const postData = {
        content: finalContent,
        team_id: sourceTeam,
        origin_team_id: sourceTeam,
        author_id: user.id,
        message_type: messageType,
        is_agent_post: true,
        poll_data: pollData,
        media_url: messageType === 'upload' ? mediaUrl : null,
        embed_code: messageType === 'embed' && embedList.length === 0 ? embedCode : null,
        embeds: embedList.length > 0 ? embedList : null,
        target_audience: addToSpotlight ? ['team_feed', 'spotlight'] : ['team_feed'],
        delivery_status: 'scheduled',
        scheduled_at: scheduledTime.toISOString(),
        scheduled_teams: selectedTeams,
        is_spotlight: addToSpotlight
      };

      // Add tags if provided
      if (tags.trim()) {
        postData.content += ` ${tags.split(',').map(tag => `#${tag.trim()}`).join(' ')}`;
      }

      const { error } = await supabase
        .from('posts')
        .insert(postData);

      if (error) throw error;

      setScheduledAt(scheduledTime);
      setScheduleDialogOpen(false);

      toast({
        title: "Broadcast Scheduled",
        description: `Message scheduled for ${scheduledTime.toLocaleString()}`,
      });

      // Clear form
      setContent('');
      setMediaUrl('');
      setMediaType(null);
      setMediaCommentary('');
      setEmbedCode('');
      setEmbedPreview('');
      setEmbedList([]);
      setCurrentEmbedCommentary('');
      setPollOptions(['', '']);
      setTags('');
      setSelectedTeams([]);
    } catch (error: any) {
      console.error('Schedule error:', error);
      toast({
        title: "Schedule Error",
        description: error.message || "Failed to schedule broadcast",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Create Message
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Message Settings */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="source-team">Source Team</Label>
                <Select value={sourceTeam} onValueChange={setSourceTeam}>
                  <SelectTrigger id="source-team">
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
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="destination-teams">Destination Teams</Label>
                <Select value="" onValueChange={(value) => {
                  if (value && !selectedTeams.includes(value)) {
                    setSelectedTeams(prev => [...prev, value]);
                  }
                }}>
                  <SelectTrigger id="destination-teams">
                    <SelectValue placeholder="Add destination teams" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams
                      .filter(team => !selectedTeams.includes(team.id))
                      .map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.city} {team.name} ({team.league})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {selectedTeams.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedTeams.map((teamId) => {
                      const team = teams.find(t => t.id === teamId);
                      return (
                        <Badge key={teamId} variant="secondary" className="text-xs">
                          {team ? `${team.city} ${team.name}` : teamId}
                          <X 
                            className="w-3 h-3 ml-1 cursor-pointer" 
                            onClick={() => setSelectedTeams(prev => prev.filter(id => id !== teamId))}
                          />
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message-type">Message Type</Label>
              <Select value={messageType} onValueChange={setMessageType}>
                <SelectTrigger id="message-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Text Message
                    </div>
                  </SelectItem>
                  <SelectItem value="poll">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" />
                      Poll
                    </div>
                  </SelectItem>
                  <SelectItem value="upload">
                    <div className="flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      Media Upload
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Message Content */}
          <div className="space-y-2">
            <Label htmlFor="content">Message Content (optional)</Label>
            <Textarea
              id="content"
              placeholder="Enter your message content..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[100px]"
            />
          </div>

          {/* Poll Options */}
          {messageType === 'poll' && (
            <div className="space-y-4">
              <Label>Poll Options</Label>
              {pollOptions.map((option, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder={`Option ${index + 1}`}
                    value={option}
                    onChange={(e) => updatePollOption(index, e.target.value)}
                  />
                  {pollOptions.length > 2 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removePollOption(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={addPollOption}
                className="w-full"
              >
                Add Option
              </Button>
            </div>
          )}

          {/* Media Upload */}
          {messageType === 'upload' && (
            <div className="space-y-4">
              <Label>Upload Media</Label>
              <MediaUpload 
                onFileSelected={handleMediaSelected}
                allowCommentary={true}
                onCommentaryUpdate={setMediaCommentary}
              />
              {mediaUrl && (
                <div className="space-y-2">
                  <MediaViewer 
                    url={mediaUrl} 
                    type={mediaType || 'image'}
                    className="max-h-64"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={clearMedia}
                    className="w-full"
                  >
                    Clear Media
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Simple Embed Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Link className="w-4 h-4" />
              <Label>Add Embeds</Label>
            </div>
            
            <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
              <div className="space-y-2">
                <Label htmlFor="embed-code">Embed Code or URL</Label>
                <Textarea
                  id="embed-code"
                  placeholder="Paste X/Twitter URL, YouTube URL, or embed code..."
                  value={embedCode}
                  onChange={(e) => setEmbedCode(e.target.value)}
                  className="min-h-[80px]"
                />
                {embedPreview && (
                  <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
                    Preview: {embedPreview}
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="embed-commentary">Commentary (optional)</Label>
                <Input
                  id="embed-commentary"
                  placeholder="Add commentary for this embed..."
                  value={currentEmbedCommentary}
                  onChange={(e) => setCurrentEmbedCommentary(e.target.value)}
                />
              </div>
              
              <Button
                type="button"
                onClick={addEmbed}
                disabled={!embedCode.trim()}
                className="w-full"
              >
                Add This Embed
              </Button>
            </div>

            {/* Show added embeds */}
            {embedList.length > 0 && (
              <div className="space-y-2">
                <Label>Added Embeds ({embedList.length})</Label>
                <div className="space-y-2">
                  {embedList.map((embed, index) => (
                    <div key={index} className="flex items-start gap-2 p-3 border rounded-lg bg-background">
                      <div className="flex-1 space-y-1">
                        <div className="text-sm font-medium">
                          {embed.embed_type === 'x' ? 'X/Twitter Post' : 
                           embed.embed_type === 'youtube' ? 'YouTube Video' : 'Custom Embed'}
                        </div>
                        {embed.commentary && (
                          <div className="text-sm text-muted-foreground">
                            "{embed.commentary}"
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground truncate">
                          {embed.embed_code.substring(0, 100)}...
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
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input
              id="tags"
              placeholder="Bears, NFL, GameDay"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>

          {/* Spotlight Toggle */}
          <div className="flex items-center space-x-2">
            <Switch
              id="spotlight"
              checked={addToSpotlight}
              onCheckedChange={setAddToSpotlight}
            />
            <Label htmlFor="spotlight">Add to Spotlight Feed</Label>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleSendMessage}
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Broadcasting...
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
              disabled={loading}
            >
              <Clock className="w-4 h-4 mr-2" />
              Schedule
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delivery Status */}
      {showDeliveryStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Delivery Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {deliveryStatus.map((status, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                  <span className="font-medium">{status.channel}</span>
                  <div className="flex items-center gap-2">
                    {status.status === 'delivered' && (
                      <Badge variant="default" className="bg-green-500 text-white">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Delivered
                      </Badge>
                    )}
                    {status.status === 'failed' && (
                      <Badge variant="destructive">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Failed
                      </Badge>
                    )}
                    {status.status === 'pending' && (
                      <Badge variant="secondary">
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Pending
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scheduled At Display */}
      {scheduledAt && (
        <Alert>
          <Calendar className="h-4 w-4" />
          <AlertDescription>
            Message scheduled for: {scheduledAt.toLocaleString()}
          </AlertDescription>
        </Alert>
      )}

      {/* Schedule Dialog */}
      <ScheduleDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        onSchedule={handleScheduleBroadcast}
      />

      {/* Scheduled Broadcast Processor */}
      <ScheduledBroadcastProcessor />

      {/* Post Management */}
      <PostManagement />
    </div>
  );
};
