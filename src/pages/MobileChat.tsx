import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { GlassHeader } from '@/components/mobile/GlassHeader';
import ModernChatBubble from '@/components/mobile/ModernChatBubble';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Send, Plus, Users, Settings, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { InviteButton } from '@/components/InviteButton';
import { RealtimeMessageHandler } from '@/components/optimized/RealtimeMessageHandler';
import { ModernChatInput } from '@/components/chat/ModernChatInput';
import { ImprovedMediaUpload } from '@/components/chat/ImprovedMediaUpload';
import { StartPickEmDialog } from "@/components/pickem/StartPickEmDialog";
import { PickEmView } from "@/components/pickem/PickEmView";
import { PickEmCard } from "@/components/pickem/PickEmCard";

interface Message {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  is_bot_message?: boolean;
  is_team_agent_message?: boolean;
  origin_team_id?: string;
  media_url?: string;
  media_type?: string;
  embed_code?: string;
  message_type?: string;
  poll_data?: any;
  origin_teams?: { name: string; logo_url?: string } | null;
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
  team_id: string;
  owner_id: string;
  owner_display_name?: string;
  participant_count: number;
  is_verified?: boolean;
}

export const MobileChat = () => {
  const { huddleId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [huddle, setHuddle] = useState<HuddleData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<Record<string, User>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isMediaOpen, setIsMediaOpen] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const [oldestCreatedAt, setOldestCreatedAt] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [ephemeralMessages, setEphemeralMessages] = useState<Message[]>([]);
  const [showPickEmDialog, setShowPickEmDialog] = useState(false);
  const [pickEmViewId, setPickEmViewId] = useState<string | null>(null);

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
            team_id,
            owner_id,
            team:teams(name, logo_url)
          `)
          .eq('id', huddleId)
          .single();

        if (huddleError) throw huddleError;

        // Fetch owner profile
        let ownerDisplayName = 'Someone';
        if (huddleData.owner_id) {
          const { data: ownerProfile } = await supabase.rpc('get_public_profile', { 
            target_user_id: huddleData.owner_id 
          });
          if (ownerProfile?.[0]) {
            ownerDisplayName = ownerProfile[0].display_name || ownerProfile[0].username || 'Someone';
          }
        }

// Fetch messages (get latest 50 and reverse)
const { data: messagesData, error: messagesError } = await supabase
  .from('huddle_messages')
  .select(`
    id,
    content,
    created_at,
    user_id,
    is_bot_message,
    is_team_agent_message,
    origin_team_id,
    media_url,
    media_type,
    embed_code,
    origin_teams:teams!origin_team_id(name, logo_url)
  `)
  .eq('huddle_id', huddleId)
  .order('created_at', { ascending: false })
  .limit(50);

        if (messagesError) throw messagesError;

        // Fetch users for messages
        const userIds = [...new Set(messagesData?.map(m => m.user_id) || [])];
        
        // Get current user profile if not in the list
        if (currentUser?.id && !userIds.includes(currentUser.id)) {
          userIds.push(currentUser.id);
        }
        
        // Fetch all user profiles for messages
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

        // Attach user profiles to messages
        const enrichedMessages = (messagesData || []).map(message => ({
          ...message,
          profiles: usersMap[message.user_id] || {
            display_name: `User ${message.user_id.slice(0, 8)}`,
            username: null,
            avatar_url: null
          }
        }));

        setHuddle({
          id: huddleData.id,
          name: huddleData.name,
          team_name: huddleData.team?.name || 'Team',
          team_logo_url: huddleData.team?.logo_url,
          team_id: huddleData.team_id,
          owner_id: huddleData.owner_id,
          owner_display_name: ownerDisplayName,
          participant_count: huddleData.member_count || 1,
          is_verified: huddleData.is_verified
        });

        setMessages(enrichedMessages.reverse());
        setOldestCreatedAt((messagesData || [])[0]?.created_at || null);
        setHasMore((messagesData?.length || 0) === 50);
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

  const loadOlderMessages = async () => {
    if (!hasMore || loadingMore || !oldestCreatedAt) return;
    setLoadingMore(true);
    try {
      const { data: olderData, error } = await supabase
        .from('huddle_messages')
        .select(`
          id,
          content,
          created_at,
          user_id,
          is_bot_message,
          is_team_agent_message,
          origin_team_id,
          media_url,
          media_type,
          embed_code,
          origin_teams:teams!origin_team_id(name, logo_url)
        `)
        .eq('huddle_id', huddleId)
        .lt('created_at', oldestCreatedAt)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const batch = (olderData || []).reverse();
      setMessages(prev => [...batch, ...prev]);
      setOldestCreatedAt(batch[0]?.created_at || oldestCreatedAt);
      setHasMore((olderData?.length || 0) === 50);
    } catch (err) {
      console.error('Error loading older messages:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  // Real-time message handling is done by RealtimeMessageHandler component below

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

  // Update last read when user opens the chat
  useEffect(() => {
    if (!huddleId || !currentUser) return;
    
    const updateLastRead = async () => {
      await supabase
        .from('huddle_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('huddle_id', huddleId)
        .eq('user_id', currentUser.id);
    };

    updateLastRead();
  }, [huddleId, currentUser]);

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

  const handleMediaSelected = async (url: string, type: 'image' | 'video') => {
    if (!currentUser || !huddleId) return;

    try {
      await supabase
        .from('huddle_messages')
        .insert({
          huddle_id: huddleId,
          user_id: currentUser.id,
          content: '',
          media_url: url,
          media_type: type
        });

      setIsMediaOpen(false);
    } catch (error) {
      console.error('Error sending media:', error);
    }
  };

  const handleSlashStart = useCallback((command: string) => {
    const ephemeralId = `ephemeral-${Date.now()}`;
    const ephemeralMessage: Message = {
      id: ephemeralId,
      content: `Fetching ${command.includes('score') ? 'scores' : 'stats'}...`,
      created_at: new Date().toISOString(),
      user_id: 'bot',
    };
    setEphemeralMessages(prev => [...prev, ephemeralMessage]);
    
    // Remove ephemeral message after 6 seconds if no bot response
    setTimeout(() => {
      setEphemeralMessages(prev => prev.filter(m => m.id !== ephemeralId));
    }, 6000);
  }, []);

  const handleSlashComplete = useCallback((success: boolean) => {
    setEphemeralMessages([]);
    // Add 2s fallback fetch to ensure bot message appears
    setTimeout(() => {
      // Re-fetch the latest messages by calling the fetchHuddleData function inline
      if (!huddleId || !currentUser) return;
      
      const refetchMessages = async () => {
        try {
          const { data: messagesData, error: messagesError } = await supabase
            .from('huddle_messages')
            .select(`
              id,
              content,
              created_at,
              user_id,
              is_bot_message,
              is_team_agent_message,
              origin_team_id,
              media_url,
              media_type,
              embed_code,
              origin_teams:teams!origin_team_id(name, logo_url)
            `)
            .eq('huddle_id', huddleId)
            .order('created_at', { ascending: false })
            .limit(50);

          if (messagesError) throw messagesError;
          setMessages((messagesData || []).reverse());
        } catch (error) {
          console.error('Error refetching messages:', error);
        }
      };
      
      refetchMessages();
    }, 2000);
  }, [huddleId, currentUser]);

  const handleStartPickEm = () => {
    setShowPickEmDialog(true);
  };

  const handlePickEmCreated = (instanceId: string) => {
    // Refresh messages to show the new pick'em
    // The message will be automatically added via realtime subscription
  };

  const handleViewPickEm = (instanceId: string) => {
    setPickEmViewId(instanceId);
  };

  const handleBackToChat = () => {
    setPickEmViewId(null);
  };

  // Check if current user is the owner
  const isOwner = currentUser?.id === huddle?.owner_id;

  const handleSendMessage = async (messageText: string) => {
    if (!messageText.trim() || sending || !currentUser || !huddleId) return;

    setSending(true);
    
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

      // Enrich message with current user's profile before adding to local state
      const enrichedMessage = {
        ...data,
        profiles: users[currentUser.id] || {
          id: currentUser.id,
          display_name: 'You',
          avatar_url: undefined
        }
      };

      // Add to local state
      setMessages(prev => [...prev, enrichedMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleSendMedia = async (url: string, type: 'image' | 'video') => {
    if (!currentUser || sending) return;

    setSending(true);
    try {
      const { data, error } = await supabase
        .from('huddle_messages')
        .insert({
          huddle_id: huddleId,
          user_id: currentUser.id,
          content: type === 'image' ? '📸 Image' : '🎥 Video',
          media_url: url,
          media_type: type
        })
        .select()
        .single();

      if (error) throw error;

      // Enrich message with current user's profile before adding to local state
      const enrichedMessage = {
        ...data,
        profiles: users[currentUser.id] || {
          id: currentUser.id,
          display_name: 'You',
          avatar_url: undefined
        }
      };

      // Add to local state
      setMessages(prev => [...prev, enrichedMessage]);
    } catch (error) {
      console.error('Error sending media:', error);
    } finally {
      setSending(false);
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

  // Show Pick'Em view if selected
  if (pickEmViewId) {
    return (
      <div className="h-screen bg-background">
        <div className="p-4">
          <PickEmView
            instanceId={pickEmViewId}
            onBack={handleBackToChat}
          />
        </div>
      </div>
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
              ownerDisplayName={huddle.owner_display_name}
              teamName={huddle.team_name}
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

      {/* Floating Back Button */}
      <Button
        variant="secondary"
        size="sm"
        onClick={() => navigate('/app')}
        className="fixed top-20 left-4 z-40 rounded-full h-10 w-10 p-0 bg-background/80 backdrop-blur-sm border border-border/50 shadow-lg hover:bg-background/90"
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="pb-4">
          {hasMore && !loading && (
            <div className="flex justify-center py-2">
              <button
                onClick={loadOlderMessages}
                disabled={loadingMore}
                className="text-sm text-muted-foreground hover:text-foreground px-4 py-2 rounded-lg border bg-background hover:bg-muted transition-colors"
              >
                {loadingMore ? 'Loading...' : 'Load older messages'}
              </button>
            </div>
          )}
          {[...messages, ...ephemeralMessages].map((message, index) => {
            const allMessages = [...messages, ...ephemeralMessages];
            const previousMessage = index > 0 ? allMessages[index - 1] : null;
            const isConsecutive = previousMessage && 
              previousMessage.user_id === message.user_id &&
              new Date(message.created_at).getTime() - new Date(previousMessage.created_at).getTime() < 2 * 60 * 1000;

            return (
              <ModernChatBubble
                key={message.id}
                message={message}
                currentUserId={currentUser?.id}
                teamId={huddle.team_id}
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
      <ModernChatInput
        onSendMessage={handleSendMessage}
        onSendMedia={handleSendMedia}
        onTyping={signalTyping}
        placeholder="Type a message or /score [team]..."
        disabled={sending}
        huddleId={huddle.id}
        userId={currentUser?.id}
        onSlashStart={handleSlashStart}
        onSlashComplete={handleSlashComplete}
        onPickEm={handleStartPickEm}
        showPickEm={isOwner}
      />

      {/* Improved media upload dialog - kept for backwards compatibility */}
      <Dialog open={isMediaOpen} onOpenChange={setIsMediaOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share Media</DialogTitle>
          </DialogHeader>
          <ImprovedMediaUpload
            onMediaSelected={handleMediaSelected}
            bucket="chat-media"
            onClose={() => setIsMediaOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Realtime handler for new messages */}
      {huddle?.id && (
        <RealtimeMessageHandler
          huddleId={huddle.id}
          userId={currentUser?.id}
          onNewMessage={async (msg) => {
            console.log('[Realtime] Received new message:', msg);

            let enriched = msg as any;
            if (msg.is_team_agent_message && msg.origin_team_id) {
              const { data: originTeam } = await supabase
                .from('teams')
                .select('name, logo_url')
                .eq('id', msg.origin_team_id)
                .single();
              if (originTeam) {
                enriched = { ...msg, origin_teams: { name: originTeam.name, logo_url: originTeam.logo_url } };
              }
            }

            // Clear ephemeral messages when real bot message arrives
            if (enriched.is_bot_message) {
              setEphemeralMessages([]);
            }

            setMessages(prev => {
              const exists = prev.some(m => m.id === enriched.id);
              if (exists) return prev;
              return [...prev, enriched];
            });
          }}
          onMessagesUpdate={() => {}}
        />
      )}

      <StartPickEmDialog
        open={showPickEmDialog}
        onOpenChange={setShowPickEmDialog}
        huddleId={huddle.id}
        onPickEmCreated={handlePickEmCreated}
      />
    </MobileLayout>
  );
};