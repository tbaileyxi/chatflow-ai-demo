import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { UnifiedChat } from '@/components/room/UnifiedChat';
import { ChatBottomBar } from '@/components/room/ChatBottomBar';
import { RoomChatInput } from '@/components/room/RoomChatInput';
import { FadesSidebar } from '@/components/fades/FadesSidebar';
import { FoundingMemberModal } from '@/components/founding/FoundingMemberModal';
import { toast } from 'sonner';

// Hardcoded admin emails for testing
const ADMIN_EMAILS = [
  'admin@sidehuddle.com',
  'test@test.com',
  'collin@sidehuddle.com',
  'tbaileyxi@gmail.com'
];

// Sport-specific keywords for query building
const SPORT_KEYWORDS: Record<string, string[]> = {
  nfl: ['touchdown', 'interception', 'sack', 'field goal'],
  ncaaf: ['touchdown', 'interception', 'sack', 'field goal'],
  nba: ['dunk', 'three', 'buzzer beater', 'block'],
  ncaab: ['dunk', 'three', 'buzzer beater', 'block'],
  mlb: ['home run', 'strikeout', 'walk-off'],
  nhl: ['goal', 'save', 'fight'],
  mls: ['goal', 'save', 'red card']
};

interface RoomData {
  id: string;
  name: string;
  team_id: string;
  member_count: number;
  event_id: string | null;
  is_live?: boolean;
}

interface EventData {
  id: string;
  name: string;
  subtitle: string | null;
  status: string;
  score_team1: number | null;
  score_team2: number | null;
  team1_id: string | null;
  team2_id: string | null;
  network: string | null;
}

interface TeamData {
  id: string;
  name: string;
  city: string;
  league: string | null;
}

export default function Room() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // ALL HOOKS AT TOP - before any conditional returns
  const [room, setRoom] = useState<RoomData | null>(null);
  const [event, setEvent] = useState<EventData | null>(null);
  const [team1, setTeam1] = useState<TeamData | null>(null);
  const [team2, setTeam2] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showFadesSidebar, setShowFadesSidebar] = useState(false);
  const [showFoundingModal, setShowFoundingModal] = useState(false);
  
  // Refs
  const team1Ref = useRef<TeamData | null>(null);
  const team2Ref = useRef<TeamData | null>(null);
  const initRef = useRef(false);

  // Get user email reliably from Supabase auth
  useEffect(() => {
    const checkAdmin = async () => {
      const { data } = await supabase.auth.getUser();
      const email = data?.user?.email;
      setIsAdmin(ADMIN_EMAILS.includes(email || ''));
    };
    checkAdmin();
  }, []);

  // Fetch or create room for this event
  const initializeRoom = useCallback(async () => {
    if (!eventId) return;
    if (initRef.current) return;
    initRef.current = true;
    
    setLoading(true);
    setError(null);
    
    try {
      // Fetch event details
      const { data: eventData, error: eventError } = await supabase
        .from('live_events')
        .select('*')
        .eq('id', eventId)
        .single();
      
      if (eventError || !eventData) {
        console.error('Event not found:', eventError);
        setError('Event not found');
        setLoading(false);
        return;
      }
      
      setEvent(eventData as EventData);
      
      // Determine team IDs and fetch team data
      const teamId = eventData.team1_id || eventData.team2_id;
      if (!teamId) {
        setError('Event missing team IDs');
        setLoading(false);
        return;
      }

      let localTeam1: TeamData | null = null;
      let localTeam2: TeamData | null = null;

      if (eventData.team1_id) {
        const { data: t1 } = await supabase
          .from('teams')
          .select('id, name, city, league')
          .eq('id', eventData.team1_id)
          .single();
        if (t1) {
          localTeam1 = t1;
          team1Ref.current = t1;
        }
      }

      if (eventData.team2_id) {
        const { data: t2 } = await supabase
          .from('teams')
          .select('id, name, city, league')
          .eq('id', eventData.team2_id)
          .single();
        if (t2) {
          localTeam2 = t2;
          team2Ref.current = t2;
        }
      }

      setTeam1(localTeam1);
      setTeam2(localTeam2);
      
      // Lookup huddle by event_id
      const { data: existingHuddle, error: huddleError } = await supabase
        .from('huddles')
        .select('*')
        .eq('event_id', eventId)
        .maybeSingle();
      
      if (huddleError) {
        console.error('Error looking up huddle:', huddleError);
      }
      
      if (existingHuddle) {
        setRoom({
          id: existingHuddle.id,
          name: existingHuddle.name,
          team_id: existingHuddle.team_id,
          member_count: existingHuddle.member_count || 0,
          event_id: existingHuddle.event_id,
          is_live: eventData.status === 'live'
        });
      } else if (user) {
        // Create new huddle
        const { data: newHuddle, error: createError } = await supabase
          .from('huddles')
          .insert({
            name: eventData.name,
            team_id: teamId,
            owner_id: user.id,
            event_id: eventId,
            is_private: false,
            is_official_team_huddle: false
          })
          .select()
          .single();
        
        if (createError) {
          console.error('Error creating room:', createError);
          setError(`Failed to create room: ${createError.message}`);
          setLoading(false);
          return;
        }
        
        setRoom({
          id: newHuddle.id,
          name: newHuddle.name,
          team_id: newHuddle.team_id,
          member_count: 1,
          event_id: newHuddle.event_id,
          is_live: eventData.status === 'live'
        });

        // Add user as member
        await supabase
          .from('huddle_members')
          .upsert({ huddle_id: newHuddle.id, user_id: user.id });

        // Insert @coach welcome message
        const { data: systemUser } = await supabase.rpc('get_or_create_system_user');
        if (systemUser) {
          const t1Name = localTeam1?.name || eventData.name.split(' vs ')[0] || 'Team 1';
          const t2Name = localTeam2?.name || eventData.name.split(' vs ')[1] || 'Team 2';
          
          await supabase.from('huddle_messages').insert({
            huddle_id: newHuddle.id,
            user_id: systemUser,
            content: `You're in ${t1Name} vs ${t2Name}. Drop your takes, react to the action, and talk trash responsibly. 🏈`,
            is_bot_message: true,
            message_type: 'coach_response'
          });
        }
      } else {
        setError('Login required to create room');
      }
    } catch (err) {
      console.error('Error initializing room:', err);
      setError('Failed to initialize room');
    } finally {
      setLoading(false);
    }
  }, [eventId, user]);

  useEffect(() => {
    initializeRoom();
  }, [initializeRoom]);

  // Auto-trigger pulse on room entry for live events
  useEffect(() => {
    if (!room || !event || !user) return;
    
    const isLive = event.status === 'live' || event.status === 'in_progress';
    if (!isLive) return;

    const triggerAutoPulse = async () => {
      try {
        // Check if pulse was triggered recently (last 5 minutes)
        const { data: recentPulse } = await supabase
          .from('pulse_runs')
          .select('ran_at')
          .eq('huddle_id', room.id)
          .order('ran_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const lastPulseTime = recentPulse?.ran_at ? new Date(recentPulse.ran_at).getTime() : 0;
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);

        if (lastPulseTime < fiveMinutesAgo) {
          console.log('🔄 Auto-triggering pulse on room entry...');
          
          const t1Name = team1Ref.current?.name || event.name.split(' vs ')[0] || '';
          const t2Name = team2Ref.current?.name || event.name.split(' vs ')[1] || '';
          const league = team1Ref.current?.league || team2Ref.current?.league || 'football';
          
          await supabase.functions.invoke('pulse-drop', {
            body: {
              huddle_id: room.id,
              event_id: event.id,
              team1_name: t1Name,
              team2_name: t2Name,
              team1_id: team1Ref.current?.id,
              team2_id: team2Ref.current?.id,
              event_name: event.name,
              league: league,
              is_live: true,
              bypass_rate_limit: false // Respect rate limits for auto-trigger
            }
          });
        }
      } catch (err) {
        console.error('Auto-pulse error:', err);
      }
    };

    triggerAutoPulse();
  }, [room?.id, event?.id, event?.status, user]);

  // Build query ladder for pulse drop
  const buildQueryLadder = useCallback(() => {
    const t1 = team1?.name || event?.name.split(' vs ')[0] || '';
    const t2 = team2?.name || event?.name.split(' vs ')[1] || '';
    const eventName = event?.name || '';
    const league = team1?.league || team2?.league || 'football';
    const sport = league?.toLowerCase() || 'nfl';
    
    const keywords = SPORT_KEYWORDS[sport] || SPORT_KEYWORDS['nfl'];
    const keywordString = keywords.join(' OR ');
    
    return [
      `${t1} vs ${t2} ${league} live`,
      `${t1} ${t2} ${league} highlights`,
      `${t1} ${t2} (${keywordString})`,
      `${t1} ${t2} ${eventName}`
    ].filter(q => q.trim().length > 10);
  }, [team1, team2, event]);

  // Handle DROP PULSE button
  const handleDropPulse = useCallback(async () => {
    if (!room || !event) {
      toast.error('Room or event data missing');
      return;
    }

    const t1Name = team1?.name || event.name.split(' vs ')[0] || '';
    const t2Name = team2?.name || event.name.split(' vs ')[1] || '';
    const league = team1?.league || team2?.league || 'football';
    const queries = buildQueryLadder();

    const payload = {
      huddle_id: room.id,
      event_id: event.id,
      team1_name: t1Name,
      team2_name: t2Name,
      team1_id: team1?.id,
      team2_id: team2?.id,
      event_name: event.name,
      league: league,
      queries: queries,
      is_live: room.is_live || event.status === 'live',
      bypass_rate_limit: true
    };

    try {
      const response = await supabase.functions.invoke('pulse-drop', { body: payload });

      if (response.error) {
        toast.error(`Error: ${response.error.message}`);
      } else {
        const data = response.data;
        const bySource = data.inserted_by_source || {};
        toast.success(
          `Inserted: ${data.inserted} (X: ${bySource.x || 0}, Reddit: ${bySource.reddit || 0}, YT: ${bySource.youtube || 0})`
        );
      }
    } catch (err: any) {
      console.error('Pulse drop error:', err);
      toast.error(`Error: ${err.message}`);
    }
  }, [room, event, team1, team2, buildQueryLadder]);

  // Derived values
  const team1Name = team1?.name || event?.name?.split(' vs ')[0] || 'Team 1';
  const team2Name = team2?.name || event?.name?.split(' vs ')[1] || 'Team 2';

  // CONDITIONAL RETURNS - ALL HOOKS MUST BE ABOVE THIS LINE
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading room...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center p-4">
          <p className="text-destructive font-bold mb-2">Error</p>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => navigate('/')}>Go Home</Button>
        </div>
      </div>
    );
  }

  if (!room || !event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Room not found</p>
          <Button onClick={() => navigate('/')}>Go Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border/30">
        <div className="px-4 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <div className="text-center flex-1 mx-4">
            <h1 className="font-bold text-lg truncate">{event.name}</h1>
            {(event.status === 'live' || event.score_team1 !== null) && (
              <p className="text-sm font-bold text-primary">
                {event.status === 'live' ? 'LIVE' : event.status.toUpperCase()} • {team1Name} {event.score_team1 ?? 0} – {team2Name} {event.score_team2 ?? 0}
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Drop Pulse Button - Admin only */}
            {isAdmin && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleDropPulse}
                className="h-8 text-xs px-3 border-primary text-primary hover:bg-primary/20"
              >
                <Zap className="h-3 w-3 mr-1" />
                Pulse
              </Button>
            )}

            <div className="flex items-center gap-1 bg-muted/50 rounded-full px-2 py-1">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{room.member_count}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Chat Area - Single unified stream */}
      <main className="flex-1 pt-16">
        <UnifiedChat 
          huddleId={room.id}
          team1Id={event.team1_id}
          team2Id={event.team2_id}
        />
      </main>

      {/* Fixed Bottom Section - ChatBottomBar + RoomChatInput */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-background/95 backdrop-blur-md border-t border-border/30 pb-safe">
        {user && (
          <>
            <ChatBottomBar
              huddleId={room.id}
              huddleName={event.name}
              onOpenFades={() => setShowFadesSidebar(true)}
              onOpenFoundingModal={() => setShowFoundingModal(true)}
            />
            <div className="px-4 py-2">
              <RoomChatInput
                huddleId={room.id}
                userId={user.id}
                onSendMessage={async (content, mediaUrl) => {
                  // Send message via Supabase
                  await supabase.from('huddle_messages').insert({
                    huddle_id: room.id,
                    user_id: user.id,
                    content,
                    media_url: mediaUrl,
                    media_type: mediaUrl ? 'image' : 'text'
                  });
                }}
                placeholder="Say something..."
              />
            </div>
          </>
        )}
        {!user && (
          <div className="px-4 py-3 text-center">
            <Button onClick={() => navigate('/auth')} variant="default" size="sm">
              Sign in to chat
            </Button>
          </div>
        )}
      </div>

      {/* Fades Sidebar */}
      <FadesSidebar
        huddleId={room.id}
        teamName={team1Name}
        teamLeague={team1?.league || 'NCAA'}
        open={showFadesSidebar}
        onClose={() => setShowFadesSidebar(false)}
      />

      {/* Founding Member Modal */}
      <FoundingMemberModal 
        open={showFoundingModal}
        onClose={() => setShowFoundingModal(false)}
      />
    </div>
  );
}
