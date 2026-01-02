import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { PulseFeedBackground } from '@/components/room/PulseFeedBackground';
import { RoomChatOverlay } from '@/components/room/RoomChatOverlay';
import { RoomQuickBar } from '@/components/room/RoomQuickBar';
import { DevBanner } from '@/components/debug/DevBanner';
import { RenderCounterOverlay, useRenderCount } from '@/components/debug/RenderCounter';
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
  
  // ALL HOOKS MUST BE AT THE TOP - before any conditional returns
  const [room, setRoom] = useState<RoomData | null>(null);
  const [event, setEvent] = useState<EventData | null>(null);
  const [team1, setTeam1] = useState<TeamData | null>(null);
  const [team2, setTeam2] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [huddleCreated, setHuddleCreated] = useState(false);
  const [pulseItemCount, setPulseItemCount] = useState(0);
  const [chatHeight, setChatHeight] = useState(60);
  const [lastMessageId, setLastMessageId] = useState<string | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // ALL REFS
  const pulseRefreshRef = useRef<(() => void) | null>(null);
  const team1Ref = useRef<TeamData | null>(null);
  const team2Ref = useRef<TeamData | null>(null);
  const initRef = useRef(false);
  
  // Performance: Track renders
  useRenderCount('room');

  // Stable callback for refresh ref - MUST BE BEFORE conditional returns
  const handleRefreshRef = useCallback((fn: () => void) => {
    pulseRefreshRef.current = fn;
  }, []);

  // Get user email reliably from Supabase auth
  useEffect(() => {
    const checkAdmin = async () => {
      const { data } = await supabase.auth.getUser();
      const email = data?.user?.email;
      setIsAdmin(ADMIN_EMAILS.includes(email || ''));
    };
    checkAdmin();
  }, []);

  // Fetch or create room for this event using event_id
  const initializeRoom = useCallback(async () => {
    if (!eventId) return;
    
    // Prevent double initialization - check initRef AND room state
    if (initRef.current) {
      return;
    }
    initRef.current = true;
    
    setLoading(true);
    setError(null);
    setHuddleCreated(false);
    
    try {
      // Step 1: Fetch event details
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
      
      // Step 2: Determine team IDs and fetch team data into LOCAL variables first
      const teamId = eventData.team1_id || eventData.team2_id;
      if (!teamId) {
        setError('Event missing team IDs');
        setLoading(false);
        return;
      }

      // Fetch teams into local vars, then set state ONCE
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

      // Set team state ONCE after fetching
      setTeam1(localTeam1);
      setTeam2(localTeam2);
      
      // Step 3: Lookup huddle by event_id (use maybeSingle to avoid error when not found)
      const { data: existingHuddle, error: huddleError } = await supabase
        .from('huddles')
        .select('*')
        .eq('event_id', eventId)
        .maybeSingle();
      
      if (huddleError) {
        console.error('Error looking up huddle:', huddleError);
      }
      
      if (existingHuddle) {
        console.log('Found existing huddle by event_id:', existingHuddle.id);
        setRoom({
          id: existingHuddle.id,
          name: existingHuddle.name,
          team_id: existingHuddle.team_id,
          member_count: existingHuddle.member_count || 0,
          event_id: existingHuddle.event_id,
          is_live: eventData.status === 'live'
        });
      } else if (user) {
        // Step 4: Create new huddle with event_id
        console.log('Creating new huddle for event:', eventId);
        
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
        
        setHuddleCreated(true);
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
          .upsert({
            huddle_id: newHuddle.id,
            user_id: user.id
          });

        // Insert bot welcome messages for NEW huddles only
        const { data: systemUser } = await supabase.rpc('get_or_create_system_user');
        if (systemUser) {
          // Use LOCAL variables, not state (state won't be updated yet)
          const t1Name = localTeam1?.name || eventData.name.split(' vs ')[0] || 'Team 1';
          const t2Name = localTeam2?.name || eventData.name.split(' vs ')[1] || 'Team 2';
          
          // Welcome message
          await supabase.from('huddle_messages').insert({
            huddle_id: newHuddle.id,
            user_id: systemUser,
            content: `🏟️ ${t1Name} vs ${t2Name}\nYou're in the live room. Drop takes, react, and talk trash responsibly.`,
            is_bot_message: true,
            message_type: 'coach_response'
          });

          // Game state message
          const score1 = eventData.score_team1 ?? 0;
          const score2 = eventData.score_team2 ?? 0;
          await supabase.from('huddle_messages').insert({
            huddle_id: newHuddle.id,
            user_id: systemUser,
            content: `LIVE • ${t1Name} ${score1} – ${t2Name} ${score2}\nGame updates will appear here...`,
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
  }, [eventId, user]); // REMOVED room from dependencies - prevents re-run loops

  useEffect(() => {
    initializeRoom();
  }, [initializeRoom]);

  // Handle emoji reaction from quick bar
  const handleReaction = useCallback((emoji: string) => {
    if (!selectedTargetId || !room || !user) return;
    
    supabase
      .from('huddle_message_reactions')
      .insert({
        message_id: selectedTargetId,
        user_id: user.id,
        emoji
      })
      .then(({ error }) => {
        if (error) console.error('Error adding reaction:', error);
      });
  }, [selectedTargetId, room, user]);

  // Build query ladder based on sport/league
  const buildQueryLadder = useCallback(() => {
    const t1 = team1?.name || event?.name.split(' vs ')[0] || '';
    const t2 = team2?.name || event?.name.split(' vs ')[1] || '';
    const eventName = event?.name || '';
    const league = team1?.league || team2?.league || 'football';
    const sport = league?.toLowerCase() || 'nfl';
    
    // Get sport-specific keywords
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
      event_name: event.name,
      league: league,
      queries: queries,
      is_live: room.is_live || event.status === 'live',
      bypass_rate_limit: true
    };

    console.log('Pulse drop request:', payload);

    try {
      const response = await supabase.functions.invoke('pulse-drop', {
        body: payload
      });

      console.log('Pulse drop response:', response);

      if (response.error) {
        toast.error(`Error: ${response.error.message}`);
      } else {
        const data = response.data;
        const bySource = data.inserted_by_source || {};
        toast.success(
          `Inserted: ${data.inserted} (X: ${bySource.x || 0}, Reddit: ${bySource.reddit || 0}, YT: ${bySource.youtube || 0}) | xAI=${data.has_xai_key} YT=${data.has_youtube_key}`
        );
        
        // Trigger pulse feed refresh
        pulseRefreshRef.current?.();
      }
    } catch (err: any) {
      console.error('Pulse drop error:', err);
      toast.error(`Error: ${err.message}`);
    }
  }, [room, event, team1, team2, buildQueryLadder]);

  // Derived values for rendering - computed BEFORE conditional returns
  const team1Name = team1?.name || event?.name?.split(' vs ')[0] || 'Team 1';
  const team2Name = team2?.name || event?.name?.split(' vs ')[1] || 'Team 2';

  // CONDITIONAL RETURNS - ALL HOOKS MUST BE ABOVE THIS LINE
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center pt-6">
        <div className="animate-pulse text-muted-foreground">Loading room...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center pt-6">
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
      <div className="min-h-screen bg-background flex items-center justify-center pt-6">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Room not found</p>
          <Button onClick={() => navigate('/')}>Go Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden pt-6">
      {/* Render Counter - Temporary for debugging */}
      <RenderCounterOverlay />
      
      {/* Collapsible DEV Banner - only in dev */}
      <DevBanner
        eventId={event.id}
        huddleId={room.id}
        pulseCount={pulseItemCount}
        huddleCreated={huddleCreated}
        team1Name={team1Name}
        team2Name={team2Name}
        eventStatus={event.status}
      />

      {/* Layer 1: Pulse Feed Background */}
      <div className="absolute inset-0 z-0 pt-6">
        <PulseFeedBackground 
          huddleId={room.id}
          teamId={room.team_id}
          isLive={room.is_live || false}
          onItemCountChange={setPulseItemCount}
          onRefreshRef={handleRefreshRef}
        />
      </div>

      {/* Fixed Header */}
      <header className="fixed top-6 left-0 right-0 z-50 bg-gradient-to-b from-background via-background/90 to-transparent">
        <div className="px-4 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="rounded-full bg-background/50 backdrop-blur-sm"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <div className="text-center flex-1 mx-4">
            <h1 className="font-bold text-lg truncate">{event.name}</h1>
            <p className="text-sm font-bold text-primary">
              {event.status === 'live' ? 'LIVE' : event.status.toUpperCase()} • {team1Name} {event.score_team1 ?? 0} – {team2Name} {event.score_team2 ?? 0}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Drop Pulse Button - Admin only, always visible in header */}
            {isAdmin && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleDropPulse}
                className="h-8 text-xs px-3 border-primary text-primary hover:bg-primary/20"
              >
                <Zap className="h-3 w-3 mr-1" />
                Drop Pulse
              </Button>
            )}

            <div className="flex items-center gap-1 bg-background/50 backdrop-blur-sm rounded-full px-2 py-1">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{room.member_count}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Layer 2: Chat Overlay (Bottom Sheet) */}
      <RoomChatOverlay
        huddleId={room.id}
        height={chatHeight}
        onHeightChange={setChatHeight}
        onLastMessageChange={setLastMessageId}
        onSelectedTargetChange={setSelectedTargetId}
        isLive={room.is_live || false}
        eventName={event.name}
        team1Name={team1Name}
        team2Name={team2Name}
        score1={event.score_team1}
        score2={event.score_team2}
      />

      {/* Fixed Quick Bar at absolute bottom */}
      <RoomQuickBar 
        onReaction={handleReaction} 
        huddleId={room.id}
        selectedTargetId={selectedTargetId}
      />
    </div>
  );
}
