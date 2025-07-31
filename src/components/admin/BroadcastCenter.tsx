import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { FileUpload } from '@/components/FileUpload';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Send, Clock, Upload, Link, MessageSquare, BarChart3 } from 'lucide-react';

interface Team {
  id: string;
  name: string;
  city: string;
  league: string;
}

export const BroadcastCenter = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [messageType, setMessageType] = useState('text');
  const [content, setContent] = useState('');
  const [targetAudience, setTargetAudience] = useState<string[]>(['team_feed']);
  const [isSpotlight, setIsSpotlight] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [embedUrl, setEmbedUrl] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const { toast } = useToast();

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

  const handleSendMessage = async () => {
    if (!selectedTeam || !content.trim()) {
      toast({
        title: "Error",
        description: "Please select a team and enter message content",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      let pollData = null;
      if (messageType === 'poll') {
        const validOptions = pollOptions.filter(option => option.trim());
        if (validOptions.length < 2) {
          toast({
            title: "Error",
            description: "Poll must have at least 2 options",
            variant: "destructive"
          });
          setLoading(false);
          return;
        }
        pollData = {
          question: content,
          options: validOptions.map(option => ({ text: option, votes: 0 }))
        };
      }

      const postData = {
        content,
        team_id: selectedTeam,
        message_type: messageType,
        target_audience: targetAudience,
        is_spotlight: isSpotlight,
        is_agent_post: true,
        poll_data: pollData,
        media_url: messageType === 'embed' ? embedUrl : null
      };

      const { error } = await supabase
        .from('posts')
        .insert(postData);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Message sent successfully!",
        variant: "default"
      });

      // Reset form
      setContent('');
      setPollOptions(['', '']);
      setEmbedUrl('');
      setSelectedFiles([]);
      setIsSpotlight(false);
      setTargetAudience(['team_feed']);
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
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
          <div className="space-y-2">
            <Label htmlFor="content">
              {messageType === 'poll' ? 'Poll Question' : 'Message Content'}
            </Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={messageType === 'poll' ? 'What would you like to ask?' : 'Enter your message...'}
              rows={4}
            />
          </div>

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
                        Remove
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

          {/* Embed URL */}
          {messageType === 'embed' && (
            <div className="space-y-2">
              <Label htmlFor="embed-url">X/Twitter Post URL</Label>
              <Input
                id="embed-url"
                value={embedUrl}
                onChange={(e) => setEmbedUrl(e.target.value)}
                placeholder="https://x.com/user/status/123456789"
              />
            </div>
          )}

          {/* Upload Section */}
          {messageType === 'upload' && (
            <div className="space-y-2">
              <Label>File Upload</Label>
              <FileUpload 
                onFilesSelected={setSelectedFiles}
                multiple={false}
                maxSize={25}
              />
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
              id="spotlight"
              checked={isSpotlight}
              onCheckedChange={(checked) => setIsSpotlight(checked as boolean)}
            />
            <Label htmlFor="spotlight">Add to Spotlight Feed</Label>
          </div>

          <Separator />

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button 
              onClick={handleSendMessage} 
              disabled={loading}
              className="flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              {loading ? 'Sending...' : 'Send Now'}
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Schedule
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};