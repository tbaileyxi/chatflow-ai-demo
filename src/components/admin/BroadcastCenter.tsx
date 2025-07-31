import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { MediaUpload } from '@/components/MediaUpload';
import { MediaViewer } from '@/components/MediaViewer';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Send, Clock, Upload, Link, MessageSquare, BarChart3, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';

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
  const [selectedTeam, setSelectedTeam] = useState('');
  const [messageType, setMessageType] = useState('text');
  const [content, setContent] = useState('');
  const [targetAudience, setTargetAudience] = useState<string[]>(['team_feed']);
  const [isSpotlight, setIsSpotlight] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [embedCode, setEmbedCode] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus[]>([]);
  const [showDeliveryStatus, setShowDeliveryStatus] = useState(false);
  const [embedPreview, setEmbedPreview] = useState('');

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

  const handleAudienceChange = (audience: string, checked: boolean) => {
    if (checked) {
      setTargetAudience(prev => [...prev, audience]);
    } else {
      setTargetAudience(prev => prev.filter(a => a !== audience));
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
    if (!content.trim() && !mediaUrl && messageType !== 'upload') {
      return 'Please enter message content or upload media';
    }

    if (!selectedTeam) {
      return 'Please select a team';
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

    if (targetAudience.length === 0) {
      return 'Please select at least one target audience';
    }

    return null;
  };

  const broadcastToHuddles = async (postData: any) => {
    try {
      // Get all huddles for the selected team
      const { data: huddles, error: huddlesError } = await supabase
        .from('huddles')
        .select('id, name')
        .eq('team_id', selectedTeam);

      if (huddlesError) throw huddlesError;

      // Check if side_huddles is in target audience
      if (targetAudience.includes('side_huddles') && huddles?.length) {
        // Create actual huddle messages for each huddle
        for (const huddle of huddles) {
          const { error: huddleMessageError } = await supabase
            .from('huddle_messages')
            .insert({
              content: postData.content,
              huddle_id: huddle.id,
              user_id: postData.author_id,
              media_url: postData.media_url,
              media_type: postData.media_url ? 
                (postData.message_type === 'upload' ? 
                  (postData.media_url.includes('.mp4') || postData.media_url.includes('.mov') || postData.media_url.includes('.avi') ? 'video' : 'image') 
                  : 'text') 
                : 'text'
            });

          if (huddleMessageError) {
            console.error(`Failed to broadcast to huddle ${huddle.name}:`, huddleMessageError);
            return { success: false, error: `Failed to broadcast to huddle: ${huddle.name}` };
          }
        }

        // Also create a post entry for tracking purposes
        const { error: postError } = await supabase
          .from('posts')
          .insert({
            ...postData,
            target_audience: ['side_huddles']
          });

        if (postError) {
          console.error('Failed to create tracking post:', postError);
          // Don't fail the entire operation for tracking post failure
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

    setLoading(true);
    setDeliveryStatus([]);
    setShowDeliveryStatus(true);

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

      const basePostData = {
        content: content || (mediaType === 'image' ? 'Shared an image' : mediaType === 'video' ? 'Shared a video' : ''),
        team_id: selectedTeam,
        author_id: user.id,
        message_type: messageType,
        is_spotlight: isSpotlight,
        is_agent_post: true,
        poll_data: pollData,
        media_url: messageType === 'upload' ? mediaUrl : null,
        embed_code: messageType === 'embed' ? embedCode : null
      };

      const deliveryResults: DeliveryStatus[] = [];

      // Handle different target audiences
      for (const audience of targetAudience) {
        try {
          if (audience === 'side_huddles') {
            const huddleResult = await broadcastToHuddles(basePostData);
            deliveryResults.push({
              channel: 'Side Huddles',
              status: huddleResult.success ? 'delivered' : 'failed',
              error: huddleResult.error
            });
          } else {
            // Regular post to main feeds
            const postData = {
              ...basePostData,
              target_audience: [audience]
            };

            const { error } = await supabase
              .from('posts')
              .insert(postData);

            if (error) throw error;

            deliveryResults.push({
              channel: audience === 'team_feed' ? 'Team Feed' : 
                       audience === 'team_agent' ? 'Team Agent' : 
                       audience === 'spotlight' ? 'Spotlight' : audience,
              status: 'delivered'
            });
          }
        } catch (error: any) {
          deliveryResults.push({
            channel: audience === 'team_feed' ? 'Team Feed' : 
                     audience === 'team_agent' ? 'Team Agent' : 
                     audience === 'spotlight' ? 'Spotlight' : 
                     audience === 'side_huddles' ? 'Side Huddles' : audience,
            status: 'failed',
            error: error.message
          });
        }
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
        setIsSpotlight(false);
        setTargetAudience(['team_feed']);
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
          {/* Team Selection */}
          <div className="space-y-2">
            <Label htmlFor="team-select">Select Team</Label>
            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a team to broadcast from" />
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
                  'Enter your message...'
                }
                rows={4}
              />
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
                  onMediaSelected={handleMediaSelected}
                  bucket="broadcast-media"
                  showPreview={false}
                />
              )}
            </div>
          )}

          <Separator />

          {/* Target Audience */}
          <div className="space-y-3">
            <Label>Target Audience</Label>
            <div className="grid grid-cols-2 gap-4">
              {[
                { id: 'team_agent', label: 'Team Agent' },
                { id: 'side_huddles', label: 'Side Huddles (Private)' },
                { id: 'team_feed', label: 'Team Feed' },
                { id: 'spotlight', label: 'Spotlight' }
              ].map((audience) => (
                <div key={audience.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={audience.id}
                    checked={targetAudience.includes(audience.id)}
                    onCheckedChange={(checked) => 
                      handleAudienceChange(audience.id, checked as boolean)
                    }
                  />
                  <Label htmlFor={audience.id}>{audience.label}</Label>
                </div>
              ))}
            </div>
          </div>

          {/* Spotlight Toggle */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="spotlight-toggle"
              checked={isSpotlight}
              onCheckedChange={(checked) => setIsSpotlight(checked as boolean)}
            />
            <Label htmlFor="spotlight-toggle">Add to Spotlight Feed</Label>
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
            <Button variant="outline" disabled={loading} className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Schedule
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};