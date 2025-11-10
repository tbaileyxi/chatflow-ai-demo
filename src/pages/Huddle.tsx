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
import { useToast } from '@/hooks/use-toast';
import { useAutoScroll } from '@/hooks/useAutoScroll';
import { JumpToLatest } from '@/components/JumpToLatest';
import { Zap, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { HuddleSettingsDropdown } from '@/components/HuddleSettingsDropdown';
import { InviteButton } from '@/components/InviteButton';

export const Huddle = () => {
  const { huddleId } = useParams<{ huddleId: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  
  const [huddle, setHuddle] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickEmDialog, setPickEmDialog] = useState<{ open: boolean; instanceId?: string }>({ open: false });
  const [teamName, setTeamName] = useState<string>('');
  const [showHighlights, setShowHighlights] = useState(false);
  
  // Pagination state
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [oldestCreatedAt, setOldestCreatedAt] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll functionality
  const { showJumpToLatest, scrollRef, handleAtBottomStateChange, jumpToLatest } = useAutoScroll();

  // Check if current user is owner
  const isOwner = user?.id === huddle?.owner_id;

  // Load huddle function (extracted so we can call it after payment)
  const loadHuddle = useCallback(async () => {
    if (!huddleId) return;
    
    console.log('🔄 Starting huddle load for ID:', huddleId);
    
    // Set timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.error('⏱️ Huddle loading timeout after 10 seconds');
      setLoading(false);
      toast({
        title: "Timeout",
        description: "Loading took too long. Please refresh the page.",
        variant: "destructive",
      });
    }, 10000);

    try {
      // Step 1: Load huddle
      console.log('📍 Step 1: Fetching huddle data...');
      const { data: huddle, error: huddleError } = await supabase
        .from('huddles')
        .select('*')
        .eq('id', huddleId)
        .maybeSingle();

      if (huddleError || !huddle) {
        clearTimeout(timeoutId);
        setLoading(false);
        navigate('/not-found');
        return;
      }

      const { data: team } = await supabase
        .from('teams')
        .select('*')
        .eq('id', huddle.team_id)
        .maybeSingle();

      setHuddle({ ...huddle, team });
      setTeamName(team?.name || 'Team');

      const { data: rawMessages } = await supabase
        .from('huddle_messages')
        .select(`
          *, 
          poll_data, 
          message_type,
          origin_teams:teams!origin_team_id(id, name, city, logo_url)
        `)
        .eq('huddle_id', huddleId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (rawMessages && rawMessages.length > 0) {
        const messageUserIds = [...new Set(rawMessages.map((m: any) => m.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name, username, avatar_url')
          .in('user_id', messageUserIds);

        const profilesMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
        const messagesWithProfiles = rawMessages.map((m: any) => ({
          ...m,
          profile: profilesMap.get(m.user_id) || {
            user_id: m.user_id,
            display_name: 'User',
            username: 'user'
          }
        }));

        setMessages(messagesWithProfiles.reverse());
        setOldestCreatedAt(rawMessages[rawMessages.length - 1]?.created_at || null);
        setHasMore(rawMessages.length === 50);
      }

      const { data: membersData } = await supabase
        .from('huddle_members')
        .select('user_id')
        .eq('huddle_id', huddleId)
        .limit(20);

      if (membersData && membersData.length > 0) {
        const memberIds = membersData.map(m => m.user_id);
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, display_name, username, avatar_url')
          .in('user_id', memberIds);

        setMembers(profilesData || []);
      }
      
      clearTimeout(timeoutId);
      setLoading(false);
      
      // Auto-scroll to bottom after loading
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
      }, 100);
      
    } catch (error) {
      console.error('❌ Critical error loading huddle:', error);
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [huddleId, navigate, toast]);

  // Handle membership payment success callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const membershipStatus = urlParams.get('membership');
    const sessionId = urlParams.get('session_id');

    if (membershipStatus === 'success' && sessionId && user) {
      const finalizeMembership = async () => {
        try {
          console.log('💳 Finalizing membership payment...');
          const { error } = await supabase.functions.invoke('check-huddle-membership', {
            body: { sessionId, huddleId }
          });

          if (error) throw error;

          toast({
            title: "Welcome to the huddle! 🎉",
            description: "Your membership is now active.",
          });

          // Clean up URL params
          window.history.replaceState({}, '', `/huddle/${huddleId}`);
          
          // Reload huddle data to show user as member
          loadHuddle();
        } catch (error) {
          console.error('❌ Error finalizing membership:', error);
          toast({
            title: "Membership Error",
            description: "Payment processed but membership not activated. Please contact support.",
            variant: "destructive",
          });
        }
      };

      finalizeMembership();
    } else if (membershipStatus === 'cancelled') {
      toast({
        title: "Payment Cancelled",
        description: "Your membership payment was cancelled.",
      });
      window.history.replaceState({}, '', `/huddle/${huddleId}`);
    }
  }, [huddleId, user, toast, loadHuddle]);

  // Load huddle data on mount
  useEffect(() => {
    loadHuddle();
  }, [loadHuddle]);

  // Update last read when user opens the huddle
  useEffect(() => {
    if (!huddleId || !user) return;
    
    const updateLastRead = async () => {
      await supabase
        .from('huddle_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('huddle_id', huddleId)
        .eq('user_id', user.id);
      
      // Dispatch event to notify other components that huddle was read
      window.dispatchEvent(new CustomEvent('huddleRead'));
    };

    updateLastRead();
  }, [huddleId, user]);

  // Load older messages function
  const loadMoreMessages = useCallback(async () => {
    if (!hasMore || loadingMore || !oldestCreatedAt || !huddleId) return;
    
    setLoadingMore(true);
    try {
      const { data: olderMessages } = await supabase
        .from('huddle_messages')
        .select(`
          *, 
          poll_data, 
          message_type,
          origin_teams:teams!origin_team_id(id, name, city, logo_url)
        `)
        .eq('huddle_id', huddleId)
        .lt('created_at', oldestCreatedAt)
        .order('created_at', { ascending: false })
        .limit(50);

      if (olderMessages && olderMessages.length > 0) {
        // Fetch profiles for older messages
        const messageUserIds = [...new Set(olderMessages.map((m: any) => m.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name, username, avatar_url')
          .in('user_id', messageUserIds);

        const profilesMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
        const messagesWithProfiles = olderMessages.map((m: any) => ({
          ...m,
          profile: profilesMap.get(m.user_id) || {
            user_id: m.user_id,
            display_name: 'User',
            username: 'user'
          }
        }));

        setMessages(prev => [...messagesWithProfiles.reverse(), ...prev]);
        setOldestCreatedAt(olderMessages[olderMessages.length - 1].created_at);
        setHasMore(olderMessages.length === 50);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error loading older messages:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, oldestCreatedAt, huddleId]);

  // Real-time subscriptions
  useEffect(() => {
    if (!huddleId || !user) return;

    const messagesChannel = supabase
      .channel(`messages:${huddleId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'huddle_messages',
        filter: `huddle_id=eq.${huddleId}`
      }, async (payload) => {
        if (payload.new) {
          const newMessage = payload.new as any;
          
          // Prevent duplicates - check if message already exists
          setMessages(prev => {
            if (prev.some(m => m.id === newMessage.id)) {
              return prev;
            }
            
            // Fetch profile for the new message
            supabase
              .from('profiles')
              .select('*')
              .eq('user_id', newMessage.user_id)
              .single()
              .then(({ data: profile }) => {
                const messageWithProfile = {
                  ...newMessage,
                  profile: profile || {
                    user_id: newMessage.user_id,
                    display_name: 'User',
                    username: 'user'
                  }
                };
                
                setMessages(prev => {
                  if (prev.some(m => m.id === newMessage.id)) return prev;
                  return [...prev, messageWithProfile];
                });
              });
            
            return prev;
          });
          
          // Auto-scroll to new messages
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
          }, 100);
        }
      })
      .subscribe();

    return () => {
      messagesChannel.unsubscribe();
    };
  }, [huddleId, user]);

  // Auto-scroll when messages change
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages.length]);

  // Send message
  const sendMessage = useCallback(async (content: string) => {
    if (!huddleId || !user || !content.trim()) return;

    try {
      // Fetch current user's profile from database
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id, display_name, username, avatar_url')
        .eq('user_id', user.id)
        .single();
      
      const messageData = {
        id: crypto.randomUUID(),
        content: content.trim(),
        huddle_id: huddleId,
        user_id: user.id,
        created_at: new Date().toISOString()
      };

      const messageWithProfile = {
        ...messageData,
        profile: profile || {
          user_id: user.id,
          display_name: 'User',
          username: 'user',
          avatar_url: null
        }
      };
      setMessages(prev => [...prev, messageWithProfile]);
      
      // Auto-scroll after sending
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 100);

      supabase
        .from('huddle_messages')
        .insert([messageData])
        .then(({ error }) => {
          if (error) {
            console.error('Error persisting message:', error);
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
  }, [huddleId, user, toast]);

  // Send media message
  const sendMediaMessage = useCallback(async (url: string, type: 'image' | 'video') => {
    if (!huddleId || !user) return;

    try {
      // Fetch current user's profile from database
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id, display_name, username, avatar_url')
        .eq('user_id', user.id)
        .single();
      
      const messageData = {
        id: crypto.randomUUID(),
        content: `[Shared ${type}]`,
        huddle_id: huddleId,
        user_id: user.id,
        media_url: url,
        media_type: type,
        created_at: new Date().toISOString()
      };

      const messageWithProfile = {
        ...messageData,
        profile: profile || {
          user_id: user.id,
          display_name: 'User',
          username: 'user',
          avatar_url: null
        }
      };
      setMessages(prev => [...prev, messageWithProfile]);
      
      // Auto-scroll after sending media
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 100);

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
  }, [huddleId, user, toast]);

  const retroTheme = useRetroTheme(huddle?.team?.name);

  if (loading) {
    return (
      <div className="min-h-screen-dynamic bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading huddle...</div>
      </div>
    );
  }

  if (!huddle) {
    return (
      <div className="min-h-screen-dynamic bg-background flex items-center justify-center">
        <div className="text-center">
          <h3 className="text-xl font-semibold mb-2">Huddle not found</h3>
          <p className="text-muted-foreground">This huddle may not exist or you don't have access to it.</p>
        </div>
      </div>
    );
  }

  const teamLogo = huddle?.team?.logo_url;

  return (
    <div className="min-h-screen-dynamic w-full bg-gradient-to-br from-background via-background to-team-primary/5 flex flex-col">
      {/* Floating back button - top left */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/app')}
        className="fixed top-4 left-4 z-50 h-12 w-12 rounded-full bg-background/95 backdrop-blur-sm border border-team-primary/30 hover:bg-team-primary/20 shadow-lg touch-manipulation"
        aria-label="Back to huddles"
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>

      {/* Mobile-first header - sticky at top */}
      <div className="retro-header sticky top-0 z-20 px-3 sm:px-4 py-2 sm:py-3 border-b border-team-primary/30 bg-background/95 backdrop-blur-sm safe-area-inset-top">
        <div className="flex items-center gap-2 sm:gap-3 ml-14">
          {/* Team logo - smaller on mobile */}
          {teamLogo && (
            <img 
              src={teamLogo} 
              alt={teamName}
              className="h-6 w-6 sm:h-8 sm:w-8 rounded-full object-cover ring-2 ring-team-primary/40"
            />
          )}
          
          {/* Huddle info - responsive text */}
          <div className="flex-1 min-w-0">
            <h1 className="text-base sm:text-lg md:text-xl font-bold neon-text truncate">
              {huddle?.name || 'Loading...'}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground/80 truncate">
              {teamName} • {members.length} members
            </p>
          </div>
          
          {/* Action buttons - touch-friendly on mobile */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Invite button */}
            <InviteButton 
              huddleId={huddleId!} 
              ownerDisplayName={huddle?.owner?.display_name}
              teamName={teamName}
              className="h-8 w-8 sm:h-9 sm:w-9"
            />
            

            {/* Settings dropdown */}
            <HuddleSettingsDropdown
              huddleId={huddleId!}
              ownerId={huddle.owner_id}
              isOwner={isOwner}
              isVerified={huddle?.is_verified}
              huddle={huddle}
            />
          </div>
        </div>
      </div>

      {/* Main chat area - mobile-first flex layout */}
      <div className="flex-1 flex flex-col sm:flex-row relative overflow-hidden">
        {/* Messages container - full width on mobile */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Messages - mobile optimized scrolling with proper ref connection */}
          <div 
            ref={(el) => {
              if (el && scrollRef.current) {
                scrollRef.current.scrollToBottom = (behavior = 'smooth') => {
                  messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
                };
              }
            }}
            className="flex-1 overflow-y-auto overflow-x-hidden px-2 sm:px-4 py-3 sm:py-4 retro-chat-column touch-pan-y"
            onScroll={(e) => {
              const target = e.target as HTMLDivElement;
              const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 100;
              handleAtBottomStateChange(isAtBottom);
            }}
          >
            <div className="max-w-4xl mx-auto space-y-1">
              {/* Load older messages button */}
              {hasMore && (
                <div className="flex justify-center py-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadMoreMessages}
                    disabled={loadingMore}
                    className="text-sm bg-background/80 backdrop-blur-sm"
                  >
                    {loadingMore ? 'Loading...' : 'Load Older Messages'}
                  </Button>
                </div>
              )}
              
              {messages.map((message, index) => {
                const prevMessage = index > 0 ? messages[index - 1] : null;
                const isGrouped = prevMessage && 
                  prevMessage.user_id === message.user_id && 
                  !prevMessage.is_bot_message && 
                  !message.is_bot_message &&
                  (new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime()) < 60000;
                
                return (
                  <RetroMessageBubble
                    key={message.id}
                    message={message}
                    user={message.profile}
                    currentUserId={user?.id}
                    isAdmin={isAdmin}
                    isGrouped={isGrouped}
                  />
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          </div>
          
          {/* Jump to latest button */}
          <JumpToLatest visible={showJumpToLatest} onClick={jumpToLatest} />

          {/* Chat input - sticky at bottom */}
          <RetroChatInput
            onSendMessage={sendMessage}
            onSendMedia={sendMediaMessage}
            placeholder="Chat here..."
            disabled={loading}
            huddleId={huddleId!}
            teamName={teamName}
            isAdmin={isAdmin}
            onTyping={(isTyping) => {
              if (isTyping && user?.id) {
                supabase.channel(`typing:${huddleId}`).send({
                  type: 'broadcast',
                  event: 'typing',
                  payload: { userId: user.id, isTyping: true }
                });
              }
            }}
          />
        </div>

        {/* Collapsible highlights sidebar - slide over on mobile */}
        <div className={cn(
          "fixed sm:relative inset-y-0 right-0 w-full sm:w-80 max-w-sm",
          "border-l border-team-primary/20 bg-background/95 backdrop-blur-sm",
          "transition-transform duration-300 z-30",
          "safe-area-inset-top safe-area-inset-bottom",
          showHighlights ? "translate-x-0" : "translate-x-full"
        )}>
          <RetroHighlightsSidebar
            huddleId={huddleId!}
            onClose={() => setShowHighlights(false)}
            onJumpToMessage={(messageId) => {
              const element = document.getElementById(`message-${messageId}`);
              element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
          />
        </div>
      </div>

      {/* Floating Highlights Button - aligned under back button in upper left */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setShowHighlights(!showHighlights)}
        className="fixed top-20 left-4 z-50 h-12 w-12 rounded-full bg-team-primary/20 backdrop-blur-sm border border-team-primary/30 hover:bg-team-primary/30 shadow-lg touch-manipulation"
        aria-label="Toggle Highlights"
      >
        <Zap className="h-5 w-5 text-team-primary" />
      </Button>

      {/* Pick 'Em Dialog */}
      {pickEmDialog.instanceId && (
        <Dialog open={pickEmDialog.open} onOpenChange={(open) => setPickEmDialog({ ...pickEmDialog, open })}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>Blitz Board - Pick 'Em Challenge</DialogTitle>
            </DialogHeader>
            <PickEmView 
              instanceId={pickEmDialog.instanceId} 
              onBack={() => setPickEmDialog({ open: false })}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
