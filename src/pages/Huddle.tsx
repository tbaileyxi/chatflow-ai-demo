import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { DateDivider } from '@/components/chat/DateDivider';
import { Zap, ArrowLeft, Users, UserPlus } from 'lucide-react';
import { isSameDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { HuddlePeopleSheet } from '@/components/HuddlePeopleSheet';
import { StartHuddleDialog } from '@/components/StartHuddleDialog';
import { SignupPromptModal } from '@/components/SignupPromptModal';

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
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [replyingToMessage, setReplyingToMessage] = useState<any>(null);
  
  // Pagination state
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [oldestCreatedAt, setOldestCreatedAt] = useState<string | null>(null);
  
  // Auto-scroll functionality (top-down layout)
  const { showJumpToNewest, scrollRef, handleScrollPosition, jumpToNewest, isNearTop } = useAutoScroll();
  const messagesContainerRef = useRef<HTMLDivElement>(null);

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
      // Step 1: Load huddle - Allow anonymous viewing of public huddles
      console.log('📍 Step 1: Fetching huddle data...');
      const { data: huddle, error: huddleError } = await supabase
        .from('huddles')
        .select('*, teams!team_id(*)')
        .eq('id', huddleId)
        .maybeSingle();

      if (huddleError || !huddle) {
        clearTimeout(timeoutId);
        setLoading(false);
        navigate('/not-found');
        return;
      }

      // Check if it's a private huddle and user is not authenticated
      if (huddle.is_private && !user) {
        clearTimeout(timeoutId);
        setLoading(false);
        toast({
          title: "Authentication Required",
          description: "Please sign in to view this private huddle.",
          variant: "destructive",
        });
        navigate('/auth');
        return;
      }

      const team = huddle.teams;
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

        setMessages(messagesWithProfiles); // Keep newest-first order (no reverse)
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
      
      // Scroll to top (newest messages) after loading
      setTimeout(() => {
        messagesContainerRef.current?.scrollTo({ top: 0, behavior: 'auto' });
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

        // Append older messages to the end (they appear below in top-down view)
        setMessages(prev => [...prev, ...messagesWithProfiles]);
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

  // Real-time subscriptions (only for authenticated users)
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
          
          // Fetch profile for the new message
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', newMessage.user_id)
            .single();
          
          const messageWithProfile = {
            ...newMessage,
            profile: profile || {
              user_id: newMessage.user_id,
              display_name: 'User',
              username: 'user'
            }
          };
          
          // Prepend new message at the top (newest-first order)
          setMessages(prev => {
            if (prev.some(m => m.id === newMessage.id)) return prev;
            return [messageWithProfile, ...prev];
          });
          
          // Auto-scroll to top if user is near the top (following live conversation)
          if (isNearTop) {
            setTimeout(() => {
              messagesContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
            }, 100);
          }
        }
      })
      .subscribe();

    return () => {
      messagesChannel.unsubscribe();
    };
  }, [huddleId, user, isNearTop]);

  // Send message (requires authentication)
  const sendMessage = useCallback(async (content: string, replyToId?: string) => {
    if (!huddleId || !content.trim()) return;
    
    if (!user) {
      setShowSignupModal(true);
      return;
    }

    // Try to fetch profile, but don't fail if it errors (network issues, token refresh, etc.)
    let profile = null;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('user_id, display_name, username, avatar_url')
        .eq('user_id', user.id)
        .single();
      profile = data;
    } catch (profileError) {
      console.warn('Could not fetch profile, using fallback:', profileError);
    }
    
    const messageData: any = {
      id: crypto.randomUUID(),
      content: content.trim(),
      huddle_id: huddleId,
      user_id: user.id,
      created_at: new Date().toISOString()
    };
    
    // Add reply_to_id if replying
    if (replyToId) {
      messageData.reply_to_id = replyToId;
    }

    const messageWithProfile = {
      ...messageData,
      profile: profile || {
        user_id: user.id,
        display_name: user.email?.split('@')[0] || 'User',
        username: 'user',
        avatar_url: null
      }
    };
    // Prepend own message at top (newest-first)
    setMessages(prev => [messageWithProfile, ...prev]);
    
    // Clear reply state
    setReplyingToMessage(null);
    
    // Scroll to top to see own message
    setTimeout(() => {
      messagesContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);

    // Fire-and-forget insert - errors handled separately
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
  }, [huddleId, user, toast]);

  // Send media message (requires authentication)
  const sendMediaMessage = useCallback(async (url: string, type: 'image' | 'video') => {
    if (!huddleId) return;
    
    if (!user) {
      setShowSignupModal(true);
      return;
    }

    // Try to fetch profile, but don't fail if it errors (network issues, token refresh, etc.)
    let profile = null;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('user_id, display_name, username, avatar_url')
        .eq('user_id', user.id)
        .single();
      profile = data;
    } catch (profileError) {
      console.warn('Could not fetch profile for media message, using fallback:', profileError);
    }
    
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
        display_name: user.email?.split('@')[0] || 'User',
        username: 'user',
        avatar_url: null
      }
    };
    // Prepend media message at top (newest-first)
    setMessages(prev => [messageWithProfile, ...prev]);
    
    // Scroll to top to see own message
    setTimeout(() => {
      messagesContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);

    // Fire-and-forget insert - errors handled separately
    supabase
      .from('huddle_messages')
      .insert([messageData])
      .then(({ error }) => {
        if (error) {
          console.error('Error persisting media message:', error);
          setMessages(prev => prev.filter(m => m.id !== messageData.id));
          toast({
            title: "Error",
            description: "Failed to send media",
            variant: "destructive",
          });
        }
      });
  }, [huddleId, user, toast]);

  // Handle invite - copies invite link to clipboard
  const handleInvite = useCallback(async () => {
    const inviteUrl = `${window.location.origin}/join/${huddleId}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast({
        title: "Link Copied!",
        description: "Share this link to invite friends to the huddle.",
      });
    } catch {
      toast({
        title: "Invite Link",
        description: inviteUrl,
      });
    }
  }, [huddleId, toast]);

  const retroTheme = useRetroTheme(huddle?.team?.name);

  // Group messages with their replies - MUST be before early returns to follow React hooks rules
  const messagesWithReplies = useMemo(() => {
    const repliesMap = new Map<string, any[]>();
    const parentMessages: any[] = [];
    
    messages.forEach(msg => {
      if (msg.reply_to_id) {
        const replies = repliesMap.get(msg.reply_to_id) || [];
        replies.push(msg);
        repliesMap.set(msg.reply_to_id, replies);
      } else {
        parentMessages.push(msg);
      }
    });
    
    return { parentMessages, repliesMap };
  }, [messages]);

  if (loading) {
    return (
      <div className="min-h-screen-dynamic bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading huddle...</div>
      </div>
    );
  }

  if (!huddle) {
    return (
      <div className="min-h-screen-dynamic bg-background flex flex-col items-center justify-center gap-4 p-8">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-foreground">Failed to Load Huddle</h2>
          <p className="text-muted-foreground">
            We couldn't load this huddle. It may not exist or you may not have access to it.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="default" onClick={() => window.location.reload()}>
            Retry
          </Button>
          <Button variant="outline" onClick={() => navigate('/')}>
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  const teamLogo = huddle?.team?.logo_url;

  return (
    <div className="min-h-screen-dynamic w-full bg-gradient-to-br from-background via-background to-team-primary/5 flex flex-col">
      {/* Mobile-first header - sticky at top with integrated back button */}
      <div className="retro-header sticky top-0 z-20 px-3 sm:px-4 py-2 sm:py-3 border-b border-team-primary/30 bg-background/95 backdrop-blur-sm safe-area-inset-top">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Back button - integrated in header */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/app')}
            className="h-9 w-9 p-0 rounded-full bg-team-primary/10 hover:bg-team-primary/20 shrink-0"
            aria-label="Back to huddles"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          {/* Team logo - smaller on mobile */}
          {teamLogo && (
            <img 
              src={teamLogo} 
              alt={teamName}
              className="h-6 w-6 sm:h-8 sm:w-8 rounded-full object-cover ring-2 ring-team-primary/40"
            />
          )}
          
          {/* Huddle name only - clean and minimal */}
          <div className="flex-1 min-w-0">
            <h1 className="text-base sm:text-lg md:text-xl font-bold neon-text truncate">
              {huddle?.name || 'Loading...'}
            </h1>
          </div>
          
          {/* Single People icon - opens bottom sheet */}
          <HuddlePeopleSheet
            huddleId={huddleId!}
            huddle={huddle}
            members={members}
            isOwner={isOwner}
            onShowHighlights={() => setShowHighlights(true)}
            onInvite={handleInvite}
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full hover:bg-team-primary/20"
            >
              <Users className="h-5 w-5" />
            </Button>
          </HuddlePeopleSheet>
        </div>
      </div>

      {/* Chat input - STICKY under header for top-down layout */}
      <div className="sticky top-[52px] sm:top-[60px] z-20 bg-background/95 backdrop-blur-sm border-b border-team-primary/30 shadow-md px-2 sm:px-4 py-2">
        <div className="max-w-4xl mx-auto">
          {user ? (
            <RetroChatInput
              onSendMessage={(content) => sendMessage(content, replyingToMessage?.id)}
              onSendMedia={sendMediaMessage}
              placeholder="Chat here..."
              disabled={loading}
              huddleId={huddleId!}
              userId={user.id}
              teamName={teamName}
              isAdmin={isAdmin}
              replyingTo={replyingToMessage}
              onCancelReply={() => setReplyingToMessage(null)}
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
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-yellow-400/10 border border-yellow-400/30 rounded-lg p-3">
              <p className="text-sm text-foreground text-center sm:text-left">
                <span className="font-semibold text-yellow-400">Join</span> to chat with fellow fans
              </p>
              <Button 
                onClick={() => {
                  localStorage.setItem('intended_huddle_id', huddleId!);
                  localStorage.setItem('intended_team_id', huddle?.team_id || '');
                  navigate('/auth?signup=true');
                }}
                className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold shrink-0 w-full sm:w-auto"
              >
                Join the Huddle
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main chat area - mobile-first flex layout */}
      <div className="flex-1 flex flex-col sm:flex-row relative overflow-hidden">
        {/* Messages container - full width on mobile */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Messages - mobile optimized scrolling */}
          <div 
            ref={(el) => {
              messagesContainerRef.current = el;
              if (el && scrollRef.current) {
                scrollRef.current.scrollToTop = (behavior: ScrollBehavior = 'smooth') => {
                  el.scrollTo({ top: 0, behavior });
                };
              }
            }}
            className="flex-1 overflow-y-auto overflow-x-hidden px-2 sm:px-4 py-3 sm:py-4 retro-chat-column touch-pan-y"
            onScroll={(e) => {
              const target = e.target as HTMLDivElement;
              handleScrollPosition(target.scrollTop);
            }}
          >
            <div className="max-w-4xl mx-auto space-y-1">
              {messagesWithReplies.parentMessages.map((message, index) => {
                const prevMessage = index > 0 ? messagesWithReplies.parentMessages[index - 1] : null;
                
                // Show date divider when date changes (top-down: check if current message's date differs from previous)
                // First message always shows divider, otherwise compare dates with null safety
                const showDateDivider = index === 0 || 
                  (prevMessage?.created_at && message.created_at && 
                   !isSameDay(new Date(message.created_at), new Date(prevMessage.created_at)));
                
                // Group consecutive messages from same user within 1 minute, with full null safety
                const isGrouped = !!(prevMessage?.created_at && message.created_at &&
                  prevMessage.user_id === message.user_id && 
                  !prevMessage.is_bot_message && 
                  !message.is_bot_message &&
                  isSameDay(new Date(message.created_at), new Date(prevMessage.created_at)) &&
                  Math.abs(new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime()) < 60000);
                
                const replies = messagesWithReplies.repliesMap.get(message.id) || [];
                
                return (
                  <React.Fragment key={message.id}>
                    {showDateDivider && <DateDivider date={new Date(message.created_at)} />}
                    <RetroMessageBubble
                      message={message}
                      user={message.profile}
                      currentUserId={user?.id}
                      isAdmin={isAdmin}
                      isGrouped={isGrouped}
                      onReply={(msg) => setReplyingToMessage(msg)}
                      replies={replies}
                    />
                  </React.Fragment>
                );
              })}
              
              {/* Load older messages button - at bottom for top-down layout */}
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
            </div>
          </div>
          
          {/* Jump to newest button */}
          <JumpToLatest visible={showJumpToNewest} onClick={jumpToNewest} />
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

      {/* Yellow FAB - bottom right, adapts to huddle type */}
      {user && (
        <div className="fixed bottom-24 right-4 z-30">
          {huddle?.is_official_team_huddle ? (
            // Public huddle → Start Side Huddle
            <StartHuddleDialog
              onHuddleCreated={() => {
                toast({
                  title: "Side Huddle Created!",
                  description: "Your private huddle has been created",
                });
              }}
              parentTeamId={huddle.team_id}
              isCreatingSideHuddle={true}
              trigger={
                <Button className="h-14 w-14 rounded-full bg-yellow-400 hover:bg-yellow-500 shadow-lg shadow-yellow-400/30">
                  <UserPlus className="h-6 w-6 text-black" />
                </Button>
              }
            />
          ) : (
            // Private huddle → Invite Friends
            <Button 
              onClick={handleInvite}
              className="h-14 w-14 rounded-full bg-yellow-400 hover:bg-yellow-500 shadow-lg shadow-yellow-400/30"
            >
              <UserPlus className="h-6 w-6 text-black" />
            </Button>
          )}
        </div>
      )}

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

      {/* Signup Prompt Modal */}
      <SignupPromptModal 
        open={showSignupModal}
        onOpenChange={setShowSignupModal}
        huddleId={huddleId}
      />
    </div>
  );
};
