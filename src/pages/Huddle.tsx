import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLiveContext, getStatusDisplay } from '@/hooks/useLiveContext';
import { UnifiedChat } from '@/components/room/UnifiedChat';
import { ChatBottomBar } from '@/components/room/ChatBottomBar';
import { RoomChatInput, RoomChatInputRef } from '@/components/room/RoomChatInput';
// Pulse content now flows directly into chat messages
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PickEmView } from '@/components/pickem/PickEmView';
import { useToast } from '@/hooks/use-toast';
import { Zap, ArrowLeft, MoreVertical, Heart, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { HuddlePeopleSheet } from '@/components/HuddlePeopleSheet';
import { SignupPromptModal } from '@/components/SignupPromptModal';
import { BadgesModal } from '@/components/badges/BadgesModal';
import { FadesSidebar } from '@/components/fades/FadesSidebar';
import { GamePulseHeader } from '@/components/game-pulse/GamePulseHeader';

export const Huddle = () => {
  const { huddleId } = useParams<{ huddleId: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  
  const [huddle, setHuddle] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickEmDialog, setPickEmDialog] = useState<{ open: boolean; instanceId?: string }>({ open: false });
  const [teamName, setTeamName] = useState<string>('');
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showBadgesModal, setShowBadgesModal] = useState(false);
  const [showFadesSidebar, setShowFadesSidebar] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [liveGame, setLiveGame] = useState<any>(null);
  const chatInputRef = useRef<RoomChatInputRef>(null);

  // Live Context Engine - automatically detects if team is in a live game
  const { context: liveContext } = useLiveContext(huddleId, huddle?.team_id);

  // Check if current user is owner
  const isOwner = user?.id === huddle?.owner_id;

  // Load huddle function
  const loadHuddle = useCallback(async () => {
    if (!huddleId) return;
    
    // Set timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      setLoading(false);
      toast({
        title: "Timeout",
        description: "Loading took too long. Please refresh the page.",
        variant: "destructive",
      });
    }, 10000);

    try {
      // Step 1: Load huddle - Allow anonymous viewing of public huddles
      const { data: huddleData, error: huddleError } = await supabase
        .from('huddles')
        .select('*, teams!team_id(*)')
        .eq('id', huddleId)
        .maybeSingle();

      if (huddleError || !huddleData) {
        clearTimeout(timeoutId);
        setLoading(false);
        navigate('/not-found');
        return;
      }

      // Check if it's a private huddle and user is not authenticated
      if (huddleData.is_private && !user) {
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

      const team = huddleData.teams;
      setHuddle({ ...huddleData, team });
      setTeamName(team?.name || 'Team');

      const { data: membersData } = await supabase
        .from('huddle_members')
        .select('user_id')
        .eq('huddle_id', huddleId)
        .limit(20);

      if (membersData && membersData.length > 0) {
        const memberIds = membersData.map(m => m.user_id);
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, display_name, username, avatar_url, is_founding_member, founding_tier')
          .in('user_id', memberIds);

        setMembers(profilesData || []);
      }
      
      clearTimeout(timeoutId);
      setLoading(false);
      
    } catch (error) {
      console.error('Error loading huddle:', error);
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [huddleId, navigate, toast, user]);

  // Handle membership payment success callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const membershipStatus = urlParams.get('membership');
    const sessionId = urlParams.get('session_id');

    if (membershipStatus === 'success' && sessionId && user) {
      const finalizeMembership = async () => {
        try {
          const { error } = await supabase.functions.invoke('check-huddle-membership', {
            body: { sessionId, huddleId }
          });

          if (error) throw error;

          toast({
            title: "Welcome to the huddle! 🎉",
            description: "Your membership is now active.",
          });

          window.history.replaceState({}, '', `/huddle/${huddleId}`);
          loadHuddle();
        } catch (error) {
          console.error('Error finalizing membership:', error);
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

  // Check if user is following this huddle (member)
  useEffect(() => {
    if (!huddleId || !user) return;
    
    const checkFollowStatus = async () => {
      const { data } = await supabase
        .from('huddle_members')
        .select('id')
        .eq('huddle_id', huddleId)
        .eq('user_id', user.id)
        .maybeSingle();
      
      setIsFollowing(!!data);
    };
    
    checkFollowStatus();
  }, [huddleId, user]);

  // Update last read when user opens the huddle
  useEffect(() => {
    if (!huddleId || !user) return;
    
    const updateLastRead = async () => {
      await supabase
        .from('huddle_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('huddle_id', huddleId)
        .eq('user_id', user.id);
      
      window.dispatchEvent(new CustomEvent('huddleRead'));
    };

    updateLastRead();
  }, [huddleId, user]);

  // Check for live games for this team
  useEffect(() => {
    if (!huddle?.team?.highlightly_id) return;

    const checkLiveGame = async () => {
      try {
        const { data: gameState } = await supabase
          .from('game_states')
          .select('*')
          .contains('teams', [{ highlightly_id: huddle.team.highlightly_id }])
          .in('last_status', ['1H', '2H', 'Q1', 'Q2', 'Q3', 'Q4', 'OT', 'HT', 'LIVE', 'IN_PLAY'])
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (gameState) {
          const teams = gameState.teams as any[];
          const homeTeam = teams?.find((t: any) => t.is_home);
          const awayTeam = teams?.find((t: any) => !t.is_home);
          const [homeScore, awayScore] = (gameState.last_score || '0-0').split('-').map(Number);

          setLiveGame({
            homeTeam: homeTeam?.name || 'Home',
            awayTeam: awayTeam?.name || 'Away',
            homeScore,
            awayScore,
            period: gameState.last_period,
            clock: gameState.last_clock,
            homeLogo: homeTeam?.logo_url,
            awayLogo: awayTeam?.logo_url,
            homeColor: huddle.team?.id === homeTeam?.team_id ? 'hsl(var(--team-primary))' : undefined,
            awayColor: huddle.team?.id === awayTeam?.team_id ? 'hsl(var(--team-primary))' : undefined,
          });
        } else {
          setLiveGame(null);
        }
      } catch (error) {
        console.error('Error checking live game:', error);
      }
    };

    checkLiveGame();
    const interval = setInterval(checkLiveGame, 30000);

    return () => clearInterval(interval);
  }, [huddle?.team?.highlightly_id, huddle?.team?.id]);

  // Follow/unfollow huddle handler
  const handleFollowToggle = useCallback(async () => {
    if (!user || !huddleId || !huddle) return;
    
    setFollowLoading(true);
    try {
      if (isFollowing) {
        const { error } = await supabase
          .from('huddle_members')
          .delete()
          .eq('huddle_id', huddleId)
          .eq('user_id', user.id);
        
        if (error) throw error;
        
        setIsFollowing(false);
        toast({
          title: "Unfollowed",
          description: `Removed from your huddles`,
        });
      } else {
        const { error } = await supabase
          .from('huddle_members')
          .insert({ huddle_id: huddleId, user_id: user.id });
        
        if (error) throw error;
        
        setIsFollowing(true);
        toast({
          title: "Following!",
          description: `Added to your huddles`,
        });
      }
    } catch (error: any) {
      console.error('Error toggling follow:', error);
      toast({
        title: "Error",
        description: "Failed to update follow status",
        variant: "destructive",
      });
    } finally {
      setFollowLoading(false);
    }
  }, [user, huddleId, huddle, isFollowing, toast]);

  // Handle invite - copies invite link to clipboard
  const handleInvite = useCallback(async () => {
    const inviteUrl = `${window.location.origin}/join-huddle/${huddleId}`;
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
      {/* Game Pulse Header - shows when a live game is detected */}
      {liveGame && <GamePulseHeader {...liveGame} />}
      
      {/* Mobile-first header - sticky at top */}
      <div className="sticky top-0 z-20 px-3 sm:px-4 py-2 sm:py-3 border-b border-border/30 bg-background/95 backdrop-blur-sm safe-area-inset-top">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Back button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/app')}
            className="h-9 w-9 p-0 rounded-full bg-muted/30 hover:bg-muted shrink-0"
            aria-label="Back to huddles"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          
          {/* Team logo */}
          {teamLogo && (
            <img 
              src={teamLogo} 
              alt={teamName}
              className="h-6 w-6 sm:h-8 sm:w-8 rounded-full object-cover ring-2 ring-primary/40"
            />
          )}
          
          {/* Huddle name with live/public/private badges */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base md:text-lg font-bold truncate">
                {huddle?.is_official_team_huddle 
                  ? (huddle?.name?.replace(' Community', '') || 'Loading...')
                  : (huddle?.name || 'Loading...')}
              </h1>
              
              {/* Live Context Mode Badge - shows LIVE/FINAL based on game state */}
              {liveContext.mode === 'live' && (
                <span className="text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded bg-destructive text-destructive-foreground animate-pulse shrink-0">
                  {getStatusDisplay(liveContext) || 'LIVE'}
                </span>
              )}
              {liveContext.mode === 'cooldown' && (
                <span className="text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded bg-orange-500 text-white shrink-0">
                  FINAL
                </span>
              )}
              
              {/* Public/Private badge */}
              <span className={cn(
                "text-[10px] sm:text-xs font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide shrink-0",
                huddle?.is_private 
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" 
                  : "bg-green-500/20 text-green-400 border border-green-500/30"
              )}>
                {huddle?.is_private ? 'Private' : 'Public'}
              </span>
            </div>
            
            {/* Game info subtitle when live */}
            {liveContext.mode !== 'normal' && liveContext.game && (
              <div className="flex items-center gap-2 text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                {liveContext.game.home_score !== null && liveContext.game.away_score !== null && (
                  <span className={cn(
                    "font-bold",
                    liveContext.mode === 'live' ? "text-destructive" : "text-orange-500"
                  )}>
                    {liveContext.game.home_score} - {liveContext.game.away_score}
                  </span>
                )}
                {liveContext.game.clock && (
                  <span>{liveContext.game.clock}</span>
                )}
              </div>
            )}
          </div>
          
          {/* Follow button for authenticated users on public huddles */}
          {user && !huddle?.is_private && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleFollowToggle}
              disabled={followLoading}
              className={cn(
                "h-9 w-9 rounded-full shrink-0",
                isFollowing 
                  ? "bg-primary hover:bg-primary/90 text-primary-foreground" 
                  : "border border-primary/50 text-primary hover:bg-primary/10"
              )}
              title={isFollowing ? "Following" : "Follow"}
            >
              {followLoading ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : isFollowing ? (
                <Check className="h-4 w-4" />
              ) : (
                <Heart className="h-4 w-4" />
              )}
            </Button>
          )}
          
          {/* People sheet */}
          <HuddlePeopleSheet
            huddleId={huddleId!}
            huddle={huddle}
            members={members}
            isOwner={isOwner}
            onInvite={handleInvite}
            onShowHighlights={() => {}}
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full hover:bg-muted"
            >
              <MoreVertical className="h-5 w-5" />
            </Button>
          </HuddlePeopleSheet>
        </div>
      </div>

      {/* Signup prompt for non-authenticated users */}
      {!user && (
        <div className="px-3 sm:px-4 py-3 bg-muted/30 border-b border-border/30">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-sm text-foreground text-center sm:text-left">
              <span className="font-semibold text-primary">Join</span> to chat with fellow fans
            </p>
            <Button 
              onClick={() => {
                localStorage.setItem('intended_huddle_id', huddleId!);
                localStorage.setItem('intended_team_id', huddle?.team_id || '');
                navigate('/auth?signup=true');
              }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shrink-0 w-full sm:w-auto"
            >
              Join the Huddle
            </Button>
          </div>
        </div>
      )}

      {/* Pulse content is now shown inline in chat as messages */}

      {/* Main Chat Area - UnifiedChat component handles messages only */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <UnifiedChat 
          huddleId={huddleId!}
          team1Id={huddle?.team_id}
          team2Id={null}
          onBadgeClick={(emoji) => chatInputRef.current?.insertEmoji(emoji)}
        />
      </main>

      {/* Fixed Bottom Section - RoomChatInput ABOVE ChatBottomBar */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-background/95 backdrop-blur-md border-t border-border/30 pb-safe">
        {user && (
          <>
            <div className="px-4 py-2">
              <RoomChatInput
                ref={chatInputRef}
                huddleId={huddleId!}
                userId={user.id}
                onSendMessage={async (content, mediaUrl) => {
                  await supabase.from('huddle_messages').insert({
                    huddle_id: huddleId,
                    user_id: user.id,
                    content,
                    media_url: mediaUrl,
                    media_type: mediaUrl ? 'image' : 'text'
                  });
                }}
                placeholder="Say something..."
              />
            </div>
            <ChatBottomBar
              huddleId={huddleId!}
              huddleName={huddle?.name}
              onOpenFades={() => setShowFadesSidebar(true)}
              onOpenBadgesModal={() => setShowBadgesModal(true)}
            />
          </>
        )}
        {!user && (
          <div className="px-4 py-3 text-center">
            <Button 
              onClick={() => {
                localStorage.setItem('intended_huddle_id', huddleId!);
                localStorage.setItem('intended_team_id', huddle?.team_id || '');
                navigate('/auth?signup=true');
              }}
              variant="default" 
              size="sm"
            >
              Sign in to chat
            </Button>
          </div>
        )}
      </div>

      {/* Yellow FABs - bottom right */}
      {/* Fades Sidebar - slide over */}
      <FadesSidebar
        huddleId={huddleId!}
        teamName={teamName}
        teamLeague={huddle?.team?.league || huddle?.teams?.league || 'NCAA'}
        open={showFadesSidebar}
        onClose={() => setShowFadesSidebar(false)}
      />

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

      {/* Badges Modal */}
      <BadgesModal 
        open={showBadgesModal}
        onClose={() => setShowBadgesModal(false)}
      />
    </div>
  );
};
