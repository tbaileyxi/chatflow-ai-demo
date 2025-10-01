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
import { UserPlus, Trophy, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const Huddle = () => {
  const { huddleId } = useParams<{ huddleId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [huddle, setHuddle] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickEmDialog, setPickEmDialog] = useState<{ open: boolean; instanceId?: string }>({ open: false });
  const [teamName, setTeamName] = useState<string>('');
  const [showHighlights, setShowHighlights] = useState(false);
  
  // Auto-scroll functionality
  const { showJumpToLatest, scrollRef, handleAtBottomStateChange, jumpToLatest, scrollToBottom } = useAutoScroll();

  // Load huddle data with comprehensive error handling
  useEffect(() => {
    if (!huddleId) return;
    
    const loadHuddle = async () => {
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
          .select('*')
          .eq('huddle_id', huddleId)
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
            profile: profilesMap.get(m.user_id) || {
              user_id: m.user_id,
              display_name: 'User',
              username: 'user'
            }
          }));

          setMessages(messagesWithProfiles);
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
        setTimeout(() => scrollToBottom('auto'), 100);
        
      } catch (error) {
        console.error('❌ Critical error loading huddle:', error);
        clearTimeout(timeoutId);
        setLoading(false);
      }
    };

    loadHuddle();
  }, [huddleId, navigate, toast, scrollToBottom]);

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
          setTimeout(() => scrollToBottom('smooth'), 100);
        }
      })
      .subscribe();

    return () => {
      messagesChannel.unsubscribe();
    };
  }, [huddleId, user, scrollToBottom]);

  // Send message
  const sendMessage = useCallback(async (content: string) => {
    if (!huddleId || !user || !content.trim()) return;

    try {
      const messageData = {
        id: crypto.randomUUID(),
        content: content.trim(),
        huddle_id: huddleId,
        user_id: user.id,
        created_at: new Date().toISOString()
      };

      const messageWithProfile = {
        ...messageData,
        profile: {
          user_id: user.id,
          display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'User',
          username: user.email?.split('@')[0] || 'user',
          avatar_url: user.user_metadata?.avatar_url
        }
      };
      setMessages(prev => [...prev, messageWithProfile]);
      
      // Auto-scroll after sending
      setTimeout(() => scrollToBottom('smooth'), 100);

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
  const sendMediaMessage = useCallback(async (file: File) => {
    if (!huddleId || !user) return;

    try {
      toast({
        title: "Uploading...",
        description: "Uploading media file",
      });

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `huddle-media/${huddleId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      const messageData = {
        id: crypto.randomUUID(),
        content: `[Shared ${file.type.startsWith('image/') ? 'image' : 'video'}]`,
        huddle_id: huddleId,
        user_id: user.id,
        media_url: publicUrl,
        media_type: file.type.startsWith('image/') ? 'image' : 'video',
        created_at: new Date().toISOString()
      };

      const messageWithProfile = {
        ...messageData,
        profile: {
          user_id: user.id,
          display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'User',
          username: user.email?.split('@')[0] || 'user',
          avatar_url: user.user_metadata?.avatar_url
        }
      };
      setMessages(prev => [...prev, messageWithProfile]);
      
      // Auto-scroll after sending media
      setTimeout(() => scrollToBottom('smooth'), 100);

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
      {/* Floating back button - always visible */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/app')}
        className="fixed top-4 left-4 z-50 h-12 w-12 rounded-full bg-background/95 backdrop-blur-sm border border-team-primary/30 hover:bg-team-primary/20 shadow-lg touch-manipulation"
        aria-label="Go back"
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/huddle/${huddleId}/settings`)}
              className="h-8 w-8 sm:h-9 sm:w-9 p-0 rounded-full hover:bg-team-primary/20"
              aria-label="Add members"
            >
              <UserPlus className="h-4 w-4 sm:h-5 sm:w-5 text-team-primary" />
            </Button>
            
            <div className="relative group">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPickEmDialog({ open: true })}
                className="h-8 w-8 sm:h-9 sm:w-9 p-0 rounded-full hover:bg-team-primary/20"
                aria-label="Blitz Board - Heat Check"
              >
                <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-team-primary" />
              </Button>
              <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-background/95 backdrop-blur-sm border border-team-primary/30 rounded-lg text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                <div className="font-semibold mb-1">Heat Check 🔥</div>
                <div className="text-muted-foreground">Pick games, compete with your huddle!</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main chat area - mobile-first flex layout */}
      <div className="flex-1 flex flex-col sm:flex-row relative overflow-hidden">
        {/* Messages container - full width on mobile */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Messages - mobile optimized scrolling */}
          <div 
            className="flex-1 overflow-y-auto overflow-x-hidden px-2 sm:px-4 py-3 sm:py-4 retro-chat-column touch-pan-y"
            onScroll={(e) => {
              const target = e.target as HTMLDivElement;
              const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 100;
              handleAtBottomStateChange(isAtBottom);
            }}
          >
            <div className="max-w-4xl mx-auto space-y-2 sm:space-y-3">
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
                    isAdmin={false}
                    isGrouped={isGrouped}
                  />
                );
              })}
            </div>
          </div>
          
          {/* Jump to latest button */}
          <JumpToLatest visible={showJumpToLatest} onClick={jumpToLatest} />

          {/* Chat input - sticky at bottom on mobile */}
          <RetroChatInput
            onSendMessage={sendMessage}
            onSendMedia={sendMediaMessage}
            placeholder="Share your thoughts..."
            disabled={loading}
            huddleId={huddleId!}
            teamName={teamName}
            onTyping={(isTyping) => {
              if (isTyping && user?.id) {
                supabase.channel(`typing:${huddleId}`).send({
                  type: 'broadcast',
                  event: 'typing',
                  payload: { userId: user.id, isTyping: true }
                });
              }
            }}
            onPickEm={() => setPickEmDialog({ open: true })}
            showPickEm={true}
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
            highlights={[]}
            onClose={() => setShowHighlights(false)}
          />
        </div>
      </div>

      {/* Mobile FAB for highlights - touch-friendly */}
      <button
        onClick={() => setShowHighlights(!showHighlights)}
        className="sm:hidden fixed bottom-20 right-3 z-40 h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-team-primary text-white shadow-lg retro-button-glow hover:scale-105 transition-transform active:scale-95 touch-manipulation"
        aria-label="Toggle highlights"
      >
        <Trophy className="h-5 w-5 sm:h-6 sm:w-6 mx-auto" />
      </button>

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
