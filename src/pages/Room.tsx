import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PulseFeedBackground } from '@/components/room/PulseFeedBackground';
import { RoomChatOverlay } from '@/components/room/RoomChatOverlay';
import { RoomQuickBar } from '@/components/room/RoomQuickBar';
import { cn } from '@/lib/utils';

interface RoomData {
  id: string;
  name: string;
  team_id: string;
  member_count: number;
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

export default function Room() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [room, setRoom] = useState<RoomData | null>(null);
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatHeight, setChatHeight] = useState(60); // 60% default
  const [lastMessageId, setLastMessageId] = useState<string | null>(null);

  // Fetch or create room for this event
  const initializeRoom = useCallback(async () => {
    if (!eventId) return;
    
    setLoading(true);
    try {
      // Fetch event details
      const { data: eventData, error: eventError } = await supabase
        .from('live_events')
        .select('*')
        .eq('id', eventId)
        .single();
      
      if (eventError || !eventData) {
        console.error('Event not found:', eventError);
        navigate('/');
        return;
      }
      
      setEvent(eventData as EventData);
      
      // Check for existing event-specific huddle
      const { data: existingHuddle } = await supabase
        .from('huddles')
        .select('*')
        .eq('name', `Event: ${eventData.name}`)
        .single();
      
      if (existingHuddle) {
        setRoom({
          id: existingHuddle.id,
          name: existingHuddle.name,
          team_id: existingHuddle.team_id,
          member_count: existingHuddle.member_count || 0,
          is_live: eventData.status === 'live'
        });
      } else if (user) {
        // Create new event-specific huddle
        const teamId = eventData.team1_id || eventData.team2_id;
        if (!teamId) {
          console.error('No team associated with event');
          navigate('/');
          return;
        }
        
        const { data: newHuddle, error: createError } = await supabase
          .from('huddles')
          .insert({
            name: `Event: ${eventData.name}`,
            team_id: teamId,
            owner_id: user.id,
            is_private: false,
            is_official_team_huddle: false
          })
          .select()
          .single();
        
        if (createError) {
          console.error('Error creating room:', createError);
          return;
        }
        
        setRoom({
          id: newHuddle.id,
          name: newHuddle.name,
          team_id: newHuddle.team_id,
          member_count: 1,
          is_live: eventData.status === 'live'
        });
      }
    } catch (error) {
      console.error('Error initializing room:', error);
    } finally {
      setLoading(false);
    }
  }, [eventId, user, navigate]);

  useEffect(() => {
    initializeRoom();
  }, [initializeRoom]);

  // Handle emoji reaction from quick bar
  const handleReaction = useCallback((emoji: string) => {
    if (!lastMessageId || !room || !user) return;
    
    // Insert reaction
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading room...</div>
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
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Layer 1: Pulse Feed Background */}
      <div className="absolute inset-0 z-0">
        <PulseFeedBackground 
          huddleId={room.id}
          teamId={room.team_id}
          isLive={room.is_live || false}
        />
      </div>

      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-background via-background/90 to-transparent">
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
      </header>

      {/* Layer 2: Chat Overlay (Bottom Sheet) */}
      <RoomChatOverlay
        huddleId={room.id}
        height={chatHeight}
        onHeightChange={setChatHeight}
        onLastMessageChange={setLastMessageId}
        isLive={room.is_live || false}
      />

      {/* Fixed Quick Bar */}
      <RoomQuickBar onReaction={handleReaction} />
    </div>
  );
}
