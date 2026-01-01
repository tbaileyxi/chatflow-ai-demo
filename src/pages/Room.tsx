import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { PulseFeedBackground } from '@/components/room/PulseFeedBackground';
import { RoomChatOverlay } from '@/components/room/RoomChatOverlay';
import { RoomQuickBar } from '@/components/room/RoomQuickBar';
import { toast } from 'sonner';

// Hardcoded admin emails for testing (remove after debugging)
const ADMIN_EMAILS = [
  'admin@sidehuddle.com',
  'test@test.com'
];

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
}

interface TeamData {
  id: string;
  name: string;
}

export default function Room() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [room, setRoom] = useState<RoomData | null>(null);
  const [event, setEvent] = useState<EventData | null>(null);
  const [team, setTeam] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [huddleCreated, setHuddleCreated] = useState(false);
  const [pulseItemCount, setPulseItemCount] = useState(0);
  const [chatHeight, setChatHeight] = useState(60);
  const [lastMessageId, setLastMessageId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Check if user is admin
  const isAdmin = userEmail ? ADMIN_EMAILS.includes(userEmail) : false;

  // Get user email
  useEffect(() => {
    if (user?.email) {
      setUserEmail(user.email);
    }
  }, [user]);

  // Fetch or create room for this event using event_id
  const initializeRoom = useCallback(async () => {
    if (!eventId) return;
    
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
      
      // Step 2: Determine team ID
      const teamId = eventData.team1_id || eventData.team2_id;
      if (!teamId) {
        setError('Event missing team IDs');
        setLoading(false);
        return;
      }

      // Step 3: Fetch team data
      const { data: teamData } = await supabase
        .from('teams')
        .select('id, name')
        .eq('id', teamId)
        .single();
      
      if (teamData) {
        setTeam(teamData);
      }
      
      // Step 4: Lookup huddle by event_id (NOT by name!)
      const { data: existingHuddle } = await supabase
        .from('huddles')
        .select('*')
        .eq('event_id', eventId)
        .limit(1)
        .single();
      
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
        // Step 5: Create new huddle with event_id
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

        // Also add user as member
        await supabase
          .from('huddle_members')
          .upsert({
            huddle_id: newHuddle.id,
            user_id: user.id
          });
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

  // Handle emoji reaction from quick bar
  const handleReaction = useCallback((emoji: string) => {
    if (!lastMessageId || !room || !user) return;
    
    supabase
      .from('huddle_message_reactions')
      .insert({
        message_id: lastMessageId,
        user_id: user.id,
        emoji
      })
      .then(({ error }) => {
        if (error) console.error('Error adding reaction:', error);
      });
  }, [lastMessageId, room, user]);

  // Handle DROP PULSE NOW button
  const handleDropPulse = async () => {
    if (!room || !team) {
      toast.error('Room or team data missing');
      return;
    }

    const payload = {
      huddle_id: room.id,
      team_id: room.team_id,
      team_name: team.name,
      is_live: room.is_live || false
    };

    console.log('Pulse drop request payload:', payload);

    try {
      const response = await supabase.functions.invoke('pulse-drop', {
        body: payload
      });

      console.log('Pulse drop response:', response);

      if (response.error) {
        toast.error(`Error: ${response.error.message}`);
      } else {
        const data = response.data;
        toast.success(`Pulse drop OK — Inserted: ${data.inserted} (Found: ${data.total_found})`);
      }
    } catch (err: any) {
      console.error('Pulse drop error:', err);
      toast.error(`Error: ${err.message}`);
    }
  };

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
      {/* Layer 1: Pulse Feed Background */}
      <div className="absolute inset-0 z-0 pt-6">
        <PulseFeedBackground 
          huddleId={room.id}
          teamId={room.team_id}
          isLive={room.is_live || false}
          onItemCountChange={setPulseItemCount}
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
            {event.status === 'live' && event.score_team1 !== null && (
              <p className="text-sm font-bold text-primary">
                {event.score_team1} - {event.score_team2}
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-1 bg-background/50 backdrop-blur-sm rounded-full px-2 py-1">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{room.member_count}</span>
          </div>
        </div>

        {/* TEST EVENT Debug Label */}
        <div className="px-4 py-1 bg-yellow-500/20 border-y border-yellow-500/30 text-[10px] font-mono">
          <span className="text-yellow-400">TEST EVENT:</span>{' '}
          <span>id={event.id.slice(0, 8)}</span>{' '}
          <span>status={event.status}</span>{' '}
          <span>team1={event.team1_id?.slice(0, 8) || 'null'}</span>{' '}
          <span>team2={event.team2_id?.slice(0, 8) || 'null'}</span>
        </div>

        {/* Debug Panel */}
        <div className="px-4 py-1 bg-blue-500/20 border-b border-blue-500/30 text-[10px] font-mono">
          <span className="text-blue-400">HUDDLE:</span>{' '}
          <span>id={room.id.slice(0, 8)}</span>{' '}
          <span>event_id={room.event_id?.slice(0, 8) || 'null'}</span>{' '}
          <span>team_id={room.team_id.slice(0, 8)}</span>{' '}
          <span>members={room.member_count}</span>{' '}
          <span className="text-green-400">created={huddleCreated ? 'yes' : 'no'}</span>
        </div>

        {/* Pulse Items Debug */}
        <div className="px-4 py-1 bg-purple-500/20 border-b border-purple-500/30 text-[10px] font-mono flex items-center justify-between">
          <span>
            <span className="text-purple-400">PULSE:</span>{' '}
            items_loaded={pulseItemCount}
          </span>
          
          {/* DROP PULSE NOW button (admin only) */}
          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleDropPulse}
              className="h-6 text-[10px] px-2 border-yellow-500 text-yellow-500 hover:bg-yellow-500/20"
            >
              <Zap className="h-3 w-3 mr-1" />
              Drop Pulse Now
            </Button>
          )}
        </div>
      </header>

      {/* Layer 2: Chat Overlay (Bottom Sheet) */}
      <RoomChatOverlay
        huddleId={room.id}
        height={chatHeight}
        onHeightChange={setChatHeight}
        onLastMessageChange={setLastMessageId}
        isLive={room.is_live || false}
      />

      {/* Fixed Quick Bar at absolute bottom */}
      <RoomQuickBar onReaction={handleReaction} />
    </div>
  );
}
