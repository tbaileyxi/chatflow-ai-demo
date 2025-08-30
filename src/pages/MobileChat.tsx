import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { GlassHeader } from '@/components/mobile/GlassHeader';
import { ModernChatBubble } from '@/components/mobile/ModernChatBubble';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Send, Plus, Users, Settings, UserPlus, Camera, Image } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { InviteButton } from '@/components/InviteButton';
import { RealtimeMessageHandler } from '@/components/optimized/RealtimeMessageHandler';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MediaUpload } from '@/components/MediaUpload';

interface Message {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  is_bot_message?: boolean;
  media_url?: string;
  media_type?: string;
  embed_code?: string;
}

interface User {
  id: string;
  display_name: string;
  avatar_url?: string;
}

interface HuddleData {
  id: string;
  name: string;
  team_name: string;
  team_logo_url?: string;
  participant_count: number;
  is_verified?: boolean;
}

export const MobileChat = () => {
  const { huddleId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [huddle, setHuddle] = useState<HuddleData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<Record<string, User>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isMediaOpen, setIsMediaOpen] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!huddleId || !currentUser) return;

    const fetchHuddleData = async () => {
      try {
        // Fetch huddle data with team info
        const { data: huddleData, error: huddleError } = await supabase
          .from('huddles')
          .select(`
            id,
            name,
            member_count,
            is_verified,
            team:teams(name, logo_url)
          `)
          .eq('id', huddleId)
          .single();

        if (huddleError) throw huddleError;

        // Fetch messages
        const { data: messagesData, error: messagesError } = await supabase
          .from('huddle_messages')
          .select('*')
          .eq('huddle_id', huddleId)
          .order('created_at', { ascending: true })
          .limit(50);

        if (messagesError) throw messagesError;

        // Fetch users for messages
        const userIds = [...new Set(messagesData?.map(m => m.user_id) || [])];
        
        // Get current user profile if not in the list
        if (currentUser?.id && !userIds.includes(currentUser.id)) {
          userIds.push(currentUser.id);
        }
        
        const { data: usersData, error: usersError } = await supabase
          .from('profiles')
          .select('user_id, display_name, avatar_url, username')
          .in('user_id', userIds);

        if (usersError) {
          console.error('Error fetching users:', usersError);
        }

        // Create users map with better fallback handling
        const usersMap: Record<string, User> = {};
        usersData?.forEach(user => {
          usersMap[user.user_id] = {
            id: user.user_id,
            display_name: user.display_name || user.username || `User ${user.user_id.slice(0, 8)}`,
            avatar_url: user.avatar_url
          };
        });

        // Ensure current user is in the map
        if (currentUser?.id && !usersMap[currentUser.id]) {
          usersMap[currentUser.id] = {
            id: currentUser.id,
            display_name: 'You',
            avatar_url: undefined
          };
        }

        // Add system bot user for team messages
        const teamName = huddleData.team?.name || 'Team';
        usersMap['system_bot'] = {
          id: 'system_bot',
          display_name: `${teamName} Bot`,
          avatar_url: huddleData.team?.logo_url
        };

        setHuddle({
          id: huddleData.id,
          name: huddleData.name,
          team_name: huddleData.team?.name || 'Team',
          team_logo_url: huddleData.team?.logo_url,
          participant_count: huddleData.member_count || 1,
          is_verified: huddleData.is_verified
        });

        setMessages(messagesData || []);
        setUsers(usersMap);
      } catch (error) {
        console.error('Error fetching huddle data:', error);
        navigate('/app');
      } finally {
        setLoading(false);
      }
    };

    fetchHuddleData();
  }, [huddleId, currentUser, navigate]);

  // Typing presence channel
  useEffect(() => {
    if (!huddleId || !currentUser) return;

    console.log('[Typing] Setting up typing channel for huddle:', huddleId);
    
    const channel = supabase.channel(`huddle-typing-${huddleId}`, {
      config: { 
        presence: { key: currentUser.id },
        broadcast: { self: true }
      }
    });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState() as Record<string, Array<{ typing?: boolean, display_name?: string }>>;
      console.log('[Typing] Presence state sync:', state);
      
      const typing = Object.entries(state)
        .filter(([key, presences]) => {
          const isTyping = presences?.some(p => p.typing);
          console.log(`[Typing] User ${key} typing:`, isTyping);
          return isTyping && key !== currentUser.id;
        })
        .map(([key]) => key);
      
      console.log('[Typing] Active typing users:', typing);
      setTypingUsers(typing);
    });

    channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      console.log('[Typing] User joined:', key, newPresences);
    });

    channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
      console.log('[Typing] User left:', key, leftPresences);
    });

    channel.subscribe((status) => {
      console.log('[Typing] Channel subscription status:', status);
      if (status === 'SUBSCRIBED') {
        channel.track({ typing: false, display_name: users[currentUser.id]?.display_name || 'You' });
      }
    });

    typingChannelRef.current = channel;
    return () => {
      console.log('[Typing] Cleaning up typing channel');
      supabase.removeChannel(channel);
    };
  }, [huddleId, currentUser, users]);

  const signalTyping = () => {
    const channel = typingChannelRef.current;
    if (!channel || !currentUser) return;
    
    console.log('[Typing] Signaling typing for user:', currentUser.id);
    channel.track({ 
      typing: true, 
      display_name: users[currentUser.id]?.display_name || 'You' 
    });
    
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => {
      console.log('[Typing] Stopping typing signal');
      channel.track({ 
        typing: false, 
        display_name: users[currentUser.id]?.display_name || 'You' 
      });
    }, 1500);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser || !huddleId) return;

    const formData = new FormData();
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    
    try {
      const { data, error } = await supabase.storage
        .from('chat-media')
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-media')
        .getPublicUrl(data.path);

      const mediaType = file.type.startsWith('video/') ? 'video' : 'image';
      
      const { data: messageData, error: messageError } = await supabase
        .from('huddle_messages')
        .insert({
          huddle_id: huddleId,
          user_id: currentUser.id,
          content: '',
          media_url: publicUrl,
          media_type: mediaType
        })
        .select()
        .single();

      if (messageError) throw messageError;

      // Reset file input
      e.target.value = '';
    } catch (err) {
      console.error('Error uploading media:', err);
    }
  };

  const handleMediaSelected = async (url: string, type: 'image' | 'video', commentary?: string) => {
    if (!currentUser || !huddleId) return;
    try {
      const { data, error } = await supabase
        .from('huddle_messages')
        .insert({
          huddle_id: huddleId,
          user_id: currentUser.id,
          content: commentary || '',
          media_url: url,
          media_type: type
        })
        .select()
        .single();
      if (error) throw error;
    } catch (err) {
      console.error('Error sending media message:', err);
    } finally {
      setIsMediaOpen(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending || !currentUser || !huddleId) return;

    setSending(true);
    const messageText = newMessage.trim();
    setNewMessage('');

    try {
      // Insert message to database
      const { data, error } = await supabase
        .from('huddle_messages')
        .insert({
          huddle_id: huddleId,
          user_id: currentUser.id,
          content: messageText,
          media_type: 'text'
        })
        .select()
        .single();

      if (error) throw error;

      // Add to local state
      setMessages(prev => [...prev, data]);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (loading) {
    return (
      <MobileLayout hasBottomNav={false}>
        <GlassHeader title="Loading..." />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading chat...</div>
        </div>
      </MobileLayout>
    );
  }

  if (!huddle) {
    return (
      <MobileLayout hasBottomNav={false}>
        <GlassHeader title="Huddle not found" />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">This huddle could not be found.</p>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout hasBottomNav={false}>
      <GlassHeader
        title={huddle.name}
        subtitle={`${huddle.team_name} • ${huddle.participant_count} members`}
        teamLogo={huddle.team_logo_url}
        rightAction={
          <div className="flex items-center gap-2">
            {huddle.is_verified && (
              <Badge variant="secondary" className="text-xs bg-verified-background text-verified-primary border-verified-border">
                Verified
              </Badge>
            )}
            <InviteButton 
              huddleId={huddle.id}
              className="p-2 hover:bg-white/10 rounded-full h-8 w-8"
            />
            <Button
              variant="ghost"
              size="sm"
              className="p-2 hover:bg-white/10 rounded-full"
              onClick={() => navigate(`/huddle/${huddle.id}/settings`)}
            >
              <Settings className="h-5 w-5 text-foreground" />
            </Button>
          </div>
        }
      />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="pb-4">
          {messages.map((message, index) => {
            const previousMessage = index > 0 ? messages[index - 1] : null;
            const isConsecutive = previousMessage && 
              previousMessage.user_id === message.user_id &&
              new Date(message.created_at).getTime() - new Date(previousMessage.created_at).getTime() < 2 * 60 * 1000;

            return (
              <ModernChatBubble
                key={message.id}
                message={message}
                user={users[message.user_id]}
                currentUserId={currentUser?.id}
                teamName={huddle.team_name}
                teamLogoUrl={huddle.team_logo_url}
                isConsecutive={isConsecutive}
                previousMessage={previousMessage}
              />
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Typing indicator */}
      {typingUsers.filter(id => id !== currentUser?.id).length > 0 && (
        <div className="px-4 pb-2 text-xs text-muted-foreground">
          {typingUsers.filter(id => id !== currentUser?.id).map(id => users[id]?.display_name || 'Someone').join(', ')} is typing...
        </div>
      )}

      {/* Chat input */}
      <div className="glass-header border-t border-white/10 p-4">
        <div className="flex items-end gap-3">
          <div className="relative shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              variant="ghost"
              size="sm"
              className="p-2 hover:bg-white/10 rounded-full"
              onClick={() => setIsMediaOpen(true)}
            >
              <Plus className="h-5 w-5 text-muted-foreground" />
            </Button>
          </div>
          
          <div className="flex-1 relative">
            <Input
              value={newMessage}
              onChange={(e) => { setNewMessage(e.target.value); signalTyping(); }}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="pr-12 rounded-full bg-muted/20 border-white/10 text-foreground placeholder:text-muted-foreground"
              disabled={sending}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || sending}
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 rounded-full bg-primary hover:bg-primary/90 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Simple camera/photos sheet */}
      <Dialog open={isMediaOpen} onOpenChange={setIsMediaOpen}>
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader className="pb-4">
            <DialogTitle>Share</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <Button
              variant="outline"
              onClick={() => {
                fileInputRef.current?.click();
                setIsMediaOpen(false);
              }}
              className="flex flex-col items-center gap-2 h-20"
            >
              <Camera className="h-6 w-6" />
              <span className="text-sm">Camera</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                photoInputRef.current?.click();
                setIsMediaOpen(false);
              }}
              className="flex flex-col items-center gap-2 h-20"
            >
              <Image className="h-6 w-6" />
              <span className="text-sm">Photos</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Realtime handler for new messages */}
      {huddle?.id && (
        <RealtimeMessageHandler
          huddleId={huddle.id}
          userId={currentUser?.id}
          onNewMessage={async (msg) => {
            console.log('[Realtime] Received new message:', msg);
            setMessages(prev => {
              // Prevent duplicates
              const exists = prev.some(m => m.id === msg.id);
              if (exists) return prev;
              return [...prev, msg];
            });
            
            // Ensure sender profile is loaded
            if (!users[msg.user_id]) {
              console.log('[Realtime] Loading profile for user:', msg.user_id);
              const { data: u } = await supabase
                .from('profiles')
                .select('user_id, display_name, avatar_url, username')
                .eq('user_id', msg.user_id)
                .single();
              if (u) {
                setUsers(prev => ({
                  ...prev,
                  [u.user_id]: {
                    id: u.user_id,
                    display_name: u.display_name || u.username || `User ${u.user_id.slice(0,8)}`,
                    avatar_url: u.avatar_url
                  }
                }));
              }
            }
          }}
          onMessagesUpdate={() => {}}
        />
      )}
    </MobileLayout>
  );
};