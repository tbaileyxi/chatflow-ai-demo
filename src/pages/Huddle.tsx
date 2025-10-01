import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRetroTheme } from '@/hooks/useRetroTheme';
import { RetroMessageBubble } from '@/components/retro/RetroMessageBubble';
import { RetroHighlightsSidebar } from '@/components/retro/RetroHighlightsSidebar';
import { RetroChatInput } from '@/components/retro/RetroChatInput';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PickEmView } from '@/components/pickem/PickEmView';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const Huddle = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [huddle, setHuddle] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickEmViewId, setPickEmViewId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [highlights, setHighlights] = useState<Array<{id: string, content: string}>>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  
  const chatChannelRef = useRef<any>(null);
  const typingChannelRef = useRef<any>(null);
  const lastTypingSentRef = useRef<number>(0);

  // Load huddle data
  useEffect(() => {
    if (!id) return;
    
    const loadHuddle = async () => {
      try {
        const { data: huddleData, error: huddleError } = await supabase
          .from('huddles')
          .select(`
            *,
            teams (id, name, city, logo_url, conference, league)
          `)
          .eq('id', id)
          .single();

        if (huddleError || !huddleData) {
          navigate('/not-found');
          return;
        }

        setHuddle({ ...huddleData, team: huddleData.teams });

        // Load messages
        const { data: rawMessages } = await supabase
          .from('huddle_messages')
          .select('*')
          .eq('huddle_id', id)
          .order('created_at', { ascending: true })
          .limit(100);

        if (rawMessages && rawMessages.length > 0) {
          const messageUserIds = [...new Set(rawMessages.map((m: any) => m.user_id))];
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, display_name, username, avatar_url')
            .in('user_id', messageUserIds);

          const profilesMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
          const messagesWithProfiles = rawMessages.map((m: any) => ({
            ...m,
            profile: profilesMap.get(m.user_id)
          }));

          setMessages(messagesWithProfiles);
        }

        // Load members
        const { data: membersData } = await supabase
          .from('huddle_members')
          .select(`user_id, profiles (user_id, display_name, username, avatar_url)`)
          .eq('huddle_id', id)
          .limit(20);

        if (membersData) {
          setMembers(membersData.map(m => m.profiles).filter(Boolean));
        }
        
      } catch (error) {
        console.error('Error loading huddle:', error);
        toast({
          title: "Error",
          description: "Failed to load huddle",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadHuddle();
  }, [id, navigate, toast]);

  // Real-time subscriptions
  useEffect(() => {
    if (!id || !user) return;

    // Subscribe to new messages
    const messagesChannel = supabase
      .channel(`messages:${id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'huddle_messages',
        filter: `huddle_id=eq.${id}`
      }, async (payload) => {
        if (payload.new) {
          // Get profile for new message
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', (payload.new as any).user_id)
            .single();

          const messageWithProfile = {
            ...payload.new,
            profiles: profile
          };

          setMessages(prev => [...prev, messageWithProfile]);
        }
      })
      .subscribe();

    // Subscribe to typing indicators
    const typingChannel = supabase
      .channel(`typing:${id}`)
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload.userId !== user.id) {
          setTypingUsers(prev => {
            const filtered = prev.filter(u => u !== payload.payload.name);
            return [...filtered, payload.payload.name];
          });
          
          // Clear typing after 3 seconds
          setTimeout(() => {
            setTypingUsers(prev => prev.filter(u => u !== payload.payload.name));
          }, 3000);
        }
      })
      .subscribe();

    chatChannelRef.current = messagesChannel;
    typingChannelRef.current = typingChannel;

    return () => {
      messagesChannel.unsubscribe();
      typingChannel.unsubscribe();
    };
  }, [id, user]);

  // Send message
  const sendMessage = useCallback(async (content: string) => {
    if (!id || !user || !content.trim()) return;

    try {
      // Simple direct insert with manual data structure
      const messageData = {
        id: crypto.randomUUID(),
        content: content.trim(),
        huddle_id: id,
        user_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Optimistically add to local state
      const messageWithProfile = {
        ...messageData,
        profiles: {
          user_id: user.id,
          display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'User',
          username: user.email?.split('@')[0] || 'user',
          avatar_url: user.user_metadata?.avatar_url
        }
      };
      setMessages(prev => [...prev, messageWithProfile]);

      // Send to database (fire and forget for better UX)
      supabase
        .from('huddle_messages')
        .insert([messageData])
        .then(({ error }) => {
          if (error) {
            console.error('Error persisting message:', error);
            // Remove from local state if failed
            setMessages(prev => prev.filter(m => m.id !== messageData.id));
            toast({
              title: "Error",
              description: "Failed to send message",
              variant: "destructive",
            });
          }
        });
        
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    }
  }, [id, user, toast]);

  // Send media message
  const sendMediaMessage = useCallback(async (file: File) => {
    if (!id || !user) return;

    try {
      toast({
        title: "Uploading...",
        description: "Uploading media file",
      });

      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `huddle-media/${id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      // Create message with media
      const messageData = {
        id: crypto.randomUUID(),
        content: `[Shared ${file.type.startsWith('image/') ? 'image' : 'video'}]`,
        huddle_id: id,
        user_id: user.id,
        media_url: publicUrl,
        media_type: file.type.startsWith('image/') ? 'image' : 'video',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Add to local state immediately
      const messageWithProfile = {
        ...messageData,
        profiles: {
          user_id: user.id,
          display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'User',
          username: user.email?.split('@')[0] || 'user',
          avatar_url: user.user_metadata?.avatar_url
        }
      };
      setMessages(prev => [...prev, messageWithProfile]);

      // Persist to database
      const { error } = await supabase
        .from('huddle_messages')
        .insert([messageData]);

      if (error) throw error;

      toast({
        title: "Uploaded!",
        description: "Media shared successfully",
      });
    } catch (error) {
      console.error('Error sending media:', error);
      toast({
        title: "Error",
        description: "Failed to send media",
        variant: "destructive",
      });
    }
  }, [id, user, toast]);

  // Message actions
  const handleMegaphone = useCallback(async (messageId: string) => {
    try {
      const message = messages.find(m => m.id === messageId);
      if (!message) return;

      toast({
        title: "Broadcasted!",
        description: "Message sent to Spotlight Feed",
      });
    } catch (error) {
      console.error('Error broadcasting:', error);
      toast({
        title: "Error",
        description: "Failed to broadcast message",
        variant: "destructive",
      });
    }
  }, [messages, toast]);

  const handleHighlight = useCallback(async (messageId: string) => {
    try {
      const message = messages.find(m => m.id === messageId);
      if (message) {
        setHighlights(prev => [...prev, { id: messageId, content: message.content }]);
        setSidebarOpen(true);
      }
      
      // Update local state for immediate feedback
      setMessages(prev => prev.map(m => 
        m.id === messageId ? { ...m, is_highlighted: true } : m
      ));
      
      toast({
        title: "Highlighted!",
        description: "Message added to highlights",
      });
    } catch (error) {
      console.error('Error highlighting:', error);
    }
  }, [messages, toast]);

  const handleCopyCallout = useCallback(async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      await handleHighlight(messageId);
      
      toast({
        title: "Called Out!",
        description: "Message copied and highlighted",
      });
    } catch (error) {
      console.error('Error calling out:', error);
    }
  }, [handleHighlight, toast]);

  const handleViewPickEm = useCallback((instanceId: string) => {
    setPickEmViewId(instanceId);
  }, []);

  const retroTheme = useRetroTheme(huddle?.team?.name);

  if (loading) {
    return (
      <div className="min-h-screen bg-background crt-effect flex items-center justify-center">
        <div className="text-muted-foreground font-arcade">Loading huddle...</div>
      </div>
    );
  }

  if (!huddle) {
    return (
      <div className="min-h-screen bg-background crt-effect flex items-center justify-center">
        <div className="text-center">
          <h3 className="text-xl font-semibold mb-2 font-orbitron">Huddle not found</h3>
          <p className="text-muted-foreground font-exo2">This huddle may not exist or you don't have access to it.</p>
        </div>
      </div>
    );
  }

  const teamName = huddle?.team?.name || huddle?.name || 'Team';
  const onlineCount = members.length;

  return (
    <div className="min-h-screen bg-background crt-effect flex">
      {/* Left Sidebar - Tight Avatars */}
      <div className="hidden md:flex flex-col w-16 bg-muted/20 border-r border-team-primary/30 p-2 gap-2">
        <div className="text-center mb-4">
          <div className="text-xs font-pixel text-team-secondary">{retroTheme.mascot}</div>
        </div>
        
        {/* Online Members - Tight */}
        <div className="space-y-1">
          {members.slice(0, 10).map((member) => (
            <div key={member.user_id} className="relative">
              <Avatar className="h-10 w-10">
                <AvatarImage src={member.avatar_url} alt={member.display_name} />
                <AvatarFallback className="text-xs font-pixel bg-team-primary/20 text-team-primary border border-team-primary/40">
                  {(member.display_name || member.username || 'U').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-background"></div>
            </div>
          ))}
        </div>
        
        <div className="mt-auto text-center">
          <div className="text-xs font-arcade text-muted-foreground">{onlineCount} online</div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-background/95 backdrop-blur border-b border-team-primary/30 p-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="retro-header text-lg neon-text">
                {teamName} Game Chat
              </h1>
              <p className="font-arcade text-xs text-muted-foreground">
                Live game discussion • {onlineCount} members online
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(true)}
              className="md:hidden"
            >
              <Star className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Chat Messages - Scrollable Container */}
        <div className="flex-1 overflow-y-auto p-2">
          <div className="max-w-4xl mx-auto space-y-1">
            {messages.map((message) => (
              <RetroMessageBubble
                key={message.id}
                message={message}
                user={message.profiles || {
                  id: message.user_id,
                  display_name: 'User',
                  username: 'user'
                }}
                currentUserId={user?.id}
                isAdmin={user?.id === huddle?.owner_id}
                onMegaphone={handleMegaphone}
                onHighlight={handleHighlight}
                onCopyCallout={handleCopyCallout}
              />
            ))}
          </div>
        </div>

        {/* Chat Input */}
        <div className="border-t border-team-primary/30 p-3 bg-background/95 backdrop-blur">
          <RetroChatInput
            onSendMessage={sendMessage}
            onSendMedia={sendMediaMessage}
            placeholder="Share your thoughts..."
            disabled={loading}
            huddleId={id!}
            teamName={teamName}
            onTyping={(isTyping) => {
              if (isTyping && user?.id) {
                const now = Date.now();
                if (now - (lastTypingSentRef.current || 0) > 1200) {
                  lastTypingSentRef.current = now;
                  const name = user.user_metadata?.display_name || user.email?.split('@')[0] || 'User';
                  typingChannelRef.current?.send({
                    type: 'broadcast',
                    event: 'typing',
                    payload: { userId: user.id, name: name }
                  });
                }
              }
            }}
          />
        </div>
      </div>

      {/* Highlights Sidebar */}
      {sidebarOpen && (
        <div className="fixed right-0 top-0 bottom-0 w-80 z-30">
          <RetroHighlightsSidebar
            onClose={() => setSidebarOpen(false)}
            highlights={highlights.map((h, index) => ({
              id: h.id,
              title: h.content.slice(0, 30) + '...',
              type: 'video' as const,
              timestamp: `${index + 1}min ago`,
              engagement: Math.floor(Math.random() * 100) + 50
            }))}
            teamName={teamName}
          />
        </div>
      )}

      {/* Mobile Floating Action Button */}
      <Button
        onClick={() => setSidebarOpen(true)}
        className="md:hidden fixed bottom-6 right-6 h-12 w-12 rounded-full retro-megaphone shadow-lg z-20"
      >
        <Star className="w-5 h-5" />
      </Button>

      {/* Pick 'Em View Dialog */}
      {pickEmViewId && (
        <Dialog open={!!pickEmViewId} onOpenChange={() => setPickEmViewId(null)}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle className="font-orbitron">Pick 'Em Details</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto">
              <PickEmView 
                instanceId={pickEmViewId} 
                onBack={() => setPickEmViewId(null)} 
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};