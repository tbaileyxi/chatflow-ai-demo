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

  const validateForm = (): string | null => {
    if (!content.trim() && !mediaUrl && !mediaCommentary.trim() && messageType !== 'upload') {
      return 'Please enter message content or upload media';
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

    if (messageType === 'embed' && !embedCode.trim()) {
      return 'Please enter embed code';
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
      if (huddles?.length) {
        for (const huddle of huddles) {
          const { data: createdMessage, error: huddleMessageError } = await supabase
            .from('huddle_messages')
            .insert({
              content: postData.content,
              huddle_id: huddle.id,
              user_id: postData.is_team_agent_message ? '00000000-0000-0000-0000-000000000000' : postData.author_id,
              origin_team_id: postData.origin_team_id,
              origin_post_id: postData.post_id, // Link to the original post for cascade deletion
              media_url: postData.media_url,
              media_type: postData.media_url ? 
                (postData.media_url.includes('.mp4') || postData.media_url.includes('.mov') || postData.media_url.includes('.webm') || postData.media_url.includes('.avi') ? 'video' : 'image') 
                : 'text',
              embed_code: postData.embed_code,
              poll_data: postData.poll_data,
              is_team_agent_message: postData.is_team_agent_message || false
            })
            .select();

          if (huddleMessageError) {
            console.error(`Failed to broadcast to huddle ${huddle.name}:`, huddleMessageError);
            return { success: false, error: `Failed to broadcast to huddle: ${huddle.name}` };
          }
        }
      }

      return { success: true };
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
        // Create the single post from the source team
        const targetAudience = addToSpotlight ? ['team_feed', 'spotlight'] : ['team_feed'];
        
        const postData = {
          content: finalContent,
          team_id: sourceTeam, // The post belongs to the source team
          origin_team_id: sourceTeam, // Track the original source team
          author_id: user.id,
          message_type: messageType,
          is_agent_post: true,
          poll_data: pollData,
          media_url: messageType === 'upload' ? mediaUrl : null,
          embed_code: messageType === 'embed' ? embedCode : null,
          target_audience: targetAudience,
          is_spotlight: addToSpotlight
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
            author_id: user.id,
            message_type: messageType,
            is_agent_post: true,
            poll_data: pollData,
            media_url: messageType === 'upload' ? mediaUrl : null,
            embed_code: messageType === 'embed' ? embedCode : null,
            target_audience: ['team_feed'], // Only team feed, no spotlight
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

        // Broadcast the source team's message to all destination teams' huddles
        const allTargetTeams = [sourceTeam, ...selectedTeams];
        const huddleContent = tags.trim() ? `${finalContent} ${tags.split(',').map(tag => `#${tag.trim()}`).join(' ')}` : finalContent;
        const huddleResult = await broadcastToHuddles({
          content: huddleContent,
          team_id: sourceTeam, // Keep source team context
          origin_team_id: sourceTeam, // Track the original source team
          author_id: user.id,
          message_type: messageType,
          is_agent_post: true,
          poll_data: pollData,
          media_url: messageType === 'upload' ? mediaUrl : null,
          embed_code: messageType === 'embed' ? embedCode : null,
          is_team_agent_message: true,
          post_id: createdPost.id // Include the post ID for linking
        }, allTargetTeams);

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
          description: `Successfully delivered to ${successCount} channel${successCount > 1 ? 's' : ''}${failureCount > 0 ? `, ${failureCount} failed` : ''}`,
        });

        // Reset form on success
        setContent('');
        setPollOptions(['', '']);
        setEmbedCode('');
        setMediaUrl('');
        setMediaType(null);
        setMediaCommentary('');
        setAddToSpotlight(false);
        setSelectedTeams([]);
        setTags('');
        
        // Delay hiding delivery status to let user see results
        setTimeout(() => setShowDeliveryStatus(false), 3000);
      } else {
        toast({
          title: "Broadcast Failed",
          description: "Failed to deliver to any channels",
          variant: "destructive"
        });
      }

    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to send message',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleBroadcast = async (scheduledAt: Date) => {
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
        pollData = {
          question: content,
          options: validOptions.map((option, index) => ({ 
            id: index, 
            text: option, 
            votes: 0 
          }))
        };
      }

      const finalContent = mediaCommentary.trim() || content || (messageType === 'upload' ? '' : '');
      const contentWithTags = tags.trim() ? `${finalContent} ${tags.split(',').map(tag => `#${tag.trim()}`).join(' ')}` : finalContent;
      const targetAudience = addToSpotlight ? ['team_feed', 'spotlight'] : ['team_feed'];

      // Schedule a single post from the source team with destination teams metadata
      const postData = {
        content: contentWithTags,
        team_id: sourceTeam, // Post belongs to source team
        origin_team_id: sourceTeam, // Track the original source team
        author_id: user.id,
        message_type: messageType,
        is_spotlight: addToSpotlight,
        is_agent_post: true,
        poll_data: pollData,
        media_url: messageType === 'upload' ? mediaUrl : null,
        embed_code: messageType === 'embed' ? embedCode : null,
        scheduled_at: scheduledAt.toISOString(),
        delivery_status: 'scheduled',
        target_audience: targetAudience,
        // Store destination teams as metadata for scheduled broadcast processor
        destination_teams: selectedTeams
      };

      const { error } = await supabase
        .from('posts')
        .insert(postData);

      if (error) throw error;


      toast({
        title: "Broadcast Scheduled",
        description: `Message scheduled for ${selectedTeams.length} team${selectedTeams.length > 1 ? 's' : ''} at ${scheduledAt.toLocaleString()}`,
      });

      // Reset form
      setContent('');
      setPollOptions(['', '']);
      setEmbedCode('');
      setMediaUrl('');
      setMediaType(null);
      setMediaCommentary('');
      setAddToSpotlight(false);
      setSelectedTeams([]);
      setTags('');
      
    } catch (error: any) {
      console.error('Error scheduling message:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to schedule message',
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
            <Send className="w-5 h-5" />
            Broadcast Center
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Source Team Selection */}
          <div className="space-y-2">
            <Label htmlFor="source-team-select">Source Team Agent</Label>
            <Select value={sourceTeam} onValueChange={setSourceTeam}>
              <SelectTrigger>
                <SelectValue placeholder="Choose agent to broadcast from" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.city} {team.name} Agent ({team.league})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Destination Teams Selection */}
          <div className="space-y-2">
            <Label>Destination Teams</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-40 overflow-y-auto border rounded-md p-3">
              {teams.map((team) => (
                <div key={team.id} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`team-${team.id}`}
                    checked={selectedTeams.includes(team.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedTeams(prev => [...prev, team.id]);
                      } else {
                        setSelectedTeams(prev => prev.filter(id => id !== team.id));
                      }
                    }}
                    className="rounded border-input"
                  />
                  <Label htmlFor={`team-${team.id}`} className="text-sm">
                    {team.city} {team.name}
                  </Label>
                </div>
              ))}
            </div>
            {selectedTeams.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Broadcasting to {selectedTeams.length} team{selectedTeams.length > 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Message Type */}
          <div className="space-y-2">
            <Label>Message Type</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button
                variant={messageType === 'text' ? 'default' : 'outline'}
                onClick={() => setMessageType('text')}
                className="flex items-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                Text
              </Button>
              <Button
                variant={messageType === 'poll' ? 'default' : 'outline'}
                onClick={() => setMessageType('poll')}
                className="flex items-center gap-2"
              >
                <BarChart3 className="w-4 h-4" />
                Poll
              </Button>
              <Button
                variant={messageType === 'upload' ? 'default' : 'outline'}
                onClick={() => setMessageType('upload')}
                className="flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Upload
              </Button>
              <Button
                variant={messageType === 'embed' ? 'default' : 'outline'}
                onClick={() => setMessageType('embed')}
                className="flex items-center gap-2"
              >
                <Link className="w-4 h-4" />
                Embed
              </Button>
            </div>
          </div>

          {/* Content Input */}
          {messageType !== 'upload' && (
            <div className="space-y-2">
              <Label htmlFor="content">
                {messageType === 'poll' ? 'Poll Question' : 'Message Content'}
              </Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={
                  messageType === 'poll' ? 'What would you like to ask?' : 
                  messageType === 'embed' ? 'Optional caption for your embed...' :
                  'Enter your message... (Use line breaks for formatting)'
                }
                rows={6}
                className="resize-vertical"
              />
              <p className="text-xs text-muted-foreground">
                Tip: Use line breaks (Enter key) to format your message with multiple paragraphs
              </p>
            </div>
          )}

          {/* Poll Options */}
          {messageType === 'poll' && (
            <div className="space-y-2">
              <Label>Poll Options</Label>
              <div className="space-y-2">
                {pollOptions.map((option, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={option}
                      onChange={(e) => updatePollOption(index, e.target.value)}
                      placeholder={`Option ${index + 1}`}
                    />
                    {pollOptions.length > 2 && (
                      <Button
                        variant="outline"
                        onClick={() => removePollOption(index)}
                        size="sm"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" onClick={addPollOption} size="sm">
                  Add Option
                </Button>
              </div>
            </div>
          )}

          {/* Embed Code */}
          {messageType === 'embed' && (
            <div className="space-y-3">
              <Label htmlFor="embed-code">Embed Code</Label>
              <Textarea
                id="embed-code"
                value={embedCode}
                onChange={(e) => setEmbedCode(e.target.value)}
                placeholder="Paste Twitter embed code, YouTube embed, Instagram embed, or custom HTML..."
                rows={6}
              />
              {embedPreview && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Preview: {embedPreview}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Upload Section */}
          {messageType === 'upload' && (
            <div className="space-y-3">
              <Label>Media Upload</Label>
              {mediaUrl ? (
                <div className="space-y-3">
                  <MediaViewer
                    mediaUrl={mediaUrl}
                    mediaType={mediaType!}
                    className="max-w-md"
                    showLightbox={false}
                  />
                  <div className="flex gap-2">
                    <Badge variant="secondary">
                      {mediaType === 'image' ? 'Image' : 'Video'} uploaded
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearMedia}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <MediaUpload
                  onMediaSelected={handleMediaWithCommentary}
                  bucket="broadcast-media"
                  showPreview={false}
                />
              )}
            </div>
          )}

          {/* Upload Commentary for Media */}
          {messageType === 'upload' && (
            <div className="space-y-2">
              <Label htmlFor="media-commentary">Message (Optional)</Label>
              <Textarea
                id="media-commentary"
                value={mediaCommentary}
                onChange={(e) => setMediaCommentary(e.target.value)}
                placeholder="Add a message to go with your upload..."
                rows={3}
              />
            </div>
          )}

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags">Tags (Optional)</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="sports, breaking, news (comma separated)"
            />
            <p className="text-xs text-muted-foreground">
              Tags will be automatically formatted with # symbols
            </p>
          </div>

          <Separator />

          {/* Simplified Broadcast Options */}
          <div className="space-y-4">
            <div>
              <Label className="text-base font-medium">Broadcast Settings</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Every message automatically goes to Team Feed and All Team Huddles
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="spotlight"
                checked={addToSpotlight}
                onCheckedChange={setAddToSpotlight}
              />
              <Label htmlFor="spotlight" className="font-medium">Add to Spotlight Feed</Label>
              <span className="text-xs text-muted-foreground">(featured across all teams)</span>
            </div>
          </div>


          {/* Delivery Status */}
          {showDeliveryStatus && deliveryStatus.length > 0 && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <div className="font-medium">Delivery Status:</div>
                  {deliveryStatus.map((status, index) => (
                    <div key={index} className="flex items-center gap-2">
                      {status.status === 'delivered' ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="text-sm">
                        {status.channel}: {status.status}
                        {status.error && ` - ${status.error}`}
                      </span>
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          <Separator />

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button 
              onClick={handleSendMessage} 
              disabled={loading}
              className="flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Broadcasting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Broadcast Now
                </>
              )}
            </Button>
            <Button variant="outline" disabled={loading} className="flex items-center gap-2" onClick={() => setScheduleDialogOpen(true)}>
              <Calendar className="w-4 h-4" />
              Schedule
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Scheduled Broadcast Processor */}
      <ScheduledBroadcastProcessor />
      
      {/* Post Management Section */}
      <PostManagement />
      
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