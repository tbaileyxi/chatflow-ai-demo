import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ChatMessage } from '@/components/room/ChatMessage';
import { RoomChatInput } from '@/components/room/RoomChatInput';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  media_url?: string;
  media_type?: string;
  message_type?: string;
  boost_amount?: number;
  is_bot_message?: boolean;
  pulse_source?: string;
  embed_code?: string;
  origin_team_id?: string;
}

interface Profile {
  user_id: string;
  display_name: string;
  username: string;
  avatar_url: string;
}

interface TeamSponsor {
  name: string;
  url?: string;
}

interface UnifiedChatProps {
  huddleId: string;
  team1Id?: string | null;
  team2Id?: string | null;
}

export const UnifiedChat = memo(function UnifiedChat({
  huddleId,
  team1Id,
  team2Id
}: UnifiedChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactionCounts, setReactionCounts] = useState<Record<string, Record<string, number>>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  // Cache profiles and team sponsors
  const profilesCacheRef = useRef<Record<string, Profile>>({});
  const sponsorsCacheRef = useRef<Record<string, TeamSponsor | null>>({});
  const [sponsors, setSponsors] = useState<Record<string, TeamSponsor | null>>({});
  const lastMessageIdsRef = useRef('');
  const lastFetchRef = useRef(0);
  const THROTTLE_MS = 1000;

  // Fetch team sponsors
  useEffect(() => {
    const fetchSponsors = async () => {
      const teamIds = [team1Id, team2Id].filter(Boolean) as string[];
      if (teamIds.length === 0) return;

      const { data } = await supabase
        .from('teams')
        .select('id, sponsor, sponsor_url')
        .in('id', teamIds);

      if (data) {
        const newSponsors: Record<string, TeamSponsor | null> = {};
        data.forEach(team => {
          if (team.sponsor) {
            newSponsors[team.id] = {
              name: team.sponsor,
              url: team.sponsor_url || undefined
            };
            sponsorsCacheRef.current[team.id] = newSponsors[team.id];
          } else {
            newSponsors[team.id] = null;
            sponsorsCacheRef.current[team.id] = null;
          }
        });
        setSponsors(newSponsors);
      }
    };

    fetchSponsors();
  }, [team1Id, team2Id]);

  // Fetch messages - ALL message types in one stream
  const fetchMessages = useCallback(async () => {
    const now = Date.now();
    if (now - lastFetchRef.current < THROTTLE_MS) return;
    lastFetchRef.current = now;
    
    const { data, error } = await supabase
      .from('huddle_messages')
      .select('*')
      .eq('huddle_id', huddleId)
      .order('created_at', { ascending: true })
      .limit(200);

    if (error) {
      console.error('Error fetching messages:', error);
      return;
    }

    // Smart diffing
    const newIds = (data || []).map(m => m.id).join(',');
    if (newIds === lastMessageIdsRef.current) return;
    lastMessageIdsRef.current = newIds;

    setMessages(data || []);
    
    // Scroll to bottom on initial load
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    // Fetch profiles for unknown users
    const userIds = [...new Set((data || []).map(m => m.user_id))];
    const unknownUserIds = userIds.filter(id => !profilesCacheRef.current[id]);
    
    if (unknownUserIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, display_name, username, avatar_url')
        .in('user_id', unknownUserIds);
      
      (profilesData || []).forEach(p => {
        profilesCacheRef.current[p.user_id] = p;
      });
    }

    // Batch fetch reaction counts
    const messageIds = (data || []).map(m => m.id);
    if (messageIds.length > 0) {
      const { data: reactions } = await supabase
        .from('huddle_message_reactions')
        .select('message_id, emoji')
        .in('message_id', messageIds);

      const counts: Record<string, Record<string, number>> = {};
      (reactions || []).forEach(r => {
        if (!counts[r.message_id]) counts[r.message_id] = {};
        counts[r.message_id][r.emoji] = (counts[r.message_id][r.emoji] || 0) + 1;
      });
      setReactionCounts(counts);
    }
  }, [huddleId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtime subscription - APPEND new messages
  useEffect(() => {
    const channel = supabase
      .channel(`unified-chat-${huddleId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'huddle_messages',
          filter: `huddle_id=eq.${huddleId}`
        },
        (payload) => {
          setMessages(prev => {
            if (prev.some(m => m.id === payload.new.id)) return prev;
            const updated = [...prev, payload.new as Message];
            lastMessageIdsRef.current = updated.map(m => m.id).join(',');
            return updated;
          });
          
          // Scroll to bottom for new messages
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
          
          // Fetch profile for new user
          const userId = payload.new.user_id;
          if (!profilesCacheRef.current[userId]) {
            supabase
              .from('profiles')
              .select('user_id, display_name, username, avatar_url')
              .eq('user_id', userId)
              .single()
              .then(({ data }) => {
                if (data) profilesCacheRef.current[userId] = data;
              });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [huddleId]);

  // Handle reaction
  const handleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!user) return;

    // Optimistic update
    setReactionCounts(prev => ({
      ...prev,
      [messageId]: {
        ...(prev[messageId] || {}),
        [emoji]: ((prev[messageId]?.[emoji]) || 0) + 1
      }
    }));

    const { error } = await supabase
      .from('huddle_message_reactions')
      .insert({
        message_id: messageId,
        user_id: user.id,
        emoji
      });

    if (error) {
      console.error('Error adding reaction:', error);
      // Revert on error
      setReactionCounts(prev => ({
        ...prev,
        [messageId]: {
          ...(prev[messageId] || {}),
          [emoji]: Math.max(0, ((prev[messageId]?.[emoji]) || 1) - 1)
        }
      }));
    }
  }, [user]);

  // Send message
  const handleSendMessage = useCallback(async (content: string, mediaUrl?: string) => {
    if (!user || !content.trim()) return;

    const { error } = await supabase
      .from('huddle_messages')
      .insert({
        huddle_id: huddleId,
        user_id: user.id,
        content: content.trim(),
        media_url: mediaUrl,
        media_type: mediaUrl ? 'image' : 'text'
      });

    if (error) {
      console.error('Error sending message:', error);
    }
  }, [huddleId, user]);

  // Get sponsor for a message (only for team-directed @coach messages)
  const getSponsorForMessage = useCallback((msg: Message): TeamSponsor | null => {
    // Only @coach messages can have sponsors
    if (!msg.is_bot_message) return null;
    
    // If message has explicit target team, use that sponsor
    if (msg.origin_team_id && sponsorsCacheRef.current[msg.origin_team_id]) {
      return sponsorsCacheRef.current[msg.origin_team_id];
    }
    
    // For pulse content, don't attach sponsors unless explicitly targeted
    if (msg.pulse_source || msg.message_type === 'pulse') {
      return null;
    }
    
    return null;
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area - scrollable */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-2"
      >
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            profile={profilesCacheRef.current[msg.user_id]}
            isOwn={msg.user_id === user?.id}
            reactionCounts={reactionCounts[msg.id] || {}}
            onReaction={(emoji) => handleReaction(msg.id, emoji)}
            sponsor={getSponsorForMessage(msg)}
          />
        ))}
        
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            Be the first to say something!
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input - fixed at bottom */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-border/30 bg-background/95 backdrop-blur-md pb-safe">
        <RoomChatInput
          huddleId={huddleId}
          userId={user?.id}
          onSendMessage={handleSendMessage}
          disabled={!user}
          placeholder="Say something..."
        />
      </div>
    </div>
  );
});
