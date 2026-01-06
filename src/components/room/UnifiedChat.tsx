import React, { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ChatMessage } from '@/components/room/ChatMessage';
import { DateDivider } from '@/components/chat/DateDivider';
import { Button } from '@/components/ui/button';
import { ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isSameDay } from 'date-fns';
import { useUserBadges } from '@/hooks/useUserBadges';

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
  onBadgeClick?: (emoji: string) => void;
}

export const UnifiedChat = memo(function UnifiedChat({
  huddleId,
  team1Id,
  team2Id,
  onBadgeClick
}: UnifiedChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [reactionCounts, setReactionCounts] = useState<Record<string, Record<string, number>>>({});
  const [showNewMessages, setShowNewMessages] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  // Cache team sponsors (profiles now in state for reactivity)
  const sponsorsCacheRef = useRef<Record<string, TeamSponsor | null>>({});
  const [sponsors, setSponsors] = useState<Record<string, TeamSponsor | null>>({});
  const lastMessageIdsRef = useRef('');
  const lastFetchRef = useRef(0);
  const THROTTLE_MS = 1000;
  const NEAR_TOP_THRESHOLD = 120;

  // Fetch user badges for all message authors
  const userIds = useMemo(() => [...new Set(messages.map(m => m.user_id))], [messages]);
  const userBadges = useUserBadges(userIds);

  // Check if user is near top of chat
  const isNearTop = useCallback(() => {
    if (!messagesContainerRef.current) return true;
    return messagesContainerRef.current.scrollTop < NEAR_TOP_THRESHOLD;
  }, []);

  // Scroll to top (where newest messages are)
  const scrollToTop = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesContainerRef.current?.scrollTo({ top: 0, behavior });
    setShowNewMessages(false);
  }, []);

  // Handle scroll position
  const handleScroll = useCallback(() => {
    if (isNearTop()) {
      setShowNewMessages(false);
    }
  }, [isNearTop]);

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

  // Fetch messages - DESCENDING ORDER (newest first)
  const fetchMessages = useCallback(async () => {
    const now = Date.now();
    if (now - lastFetchRef.current < THROTTLE_MS) return;
    lastFetchRef.current = now;
    
    const { data, error } = await supabase
      .from('huddle_messages')
      .select('*')
      .eq('huddle_id', huddleId)
      .order('created_at', { ascending: false })
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
    
    // Scroll to top on initial load (newest messages at top)
    setTimeout(() => {
      scrollToTop('auto');
    }, 100);

    // Fetch profiles for unknown users - update state for reactivity
    const userIds = [...new Set((data || []).map(m => m.user_id))];
    
    // Use functional update to get current profiles without adding to deps
    setProfiles(currentProfiles => {
      const unknownUserIds = userIds.filter(id => !currentProfiles[id]);
      
      if (unknownUserIds.length > 0) {
        // Async fetch, then update
        supabase
          .from('profiles')
          .select('user_id, display_name, username, avatar_url')
          .in('user_id', unknownUserIds)
          .then(({ data: profilesData }) => {
            if (profilesData && profilesData.length > 0) {
              setProfiles(prev => {
                const updated = { ...prev };
                profilesData.forEach(p => {
                  updated[p.user_id] = p;
                });
                return updated;
              });
            }
          });
      }
      
      return currentProfiles; // Return unchanged for now
    });

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
  }, [huddleId, scrollToTop]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtime subscription - PREPEND new messages (newest at top)
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
            // PREPEND new message at the beginning (newest first)
            const updated = [payload.new as Message, ...prev];
            lastMessageIdsRef.current = updated.map(m => m.id).join(',');
            return updated;
          });
          
          // Auto-scroll to top if user is near top, otherwise show pill
          if (isNearTop()) {
            setTimeout(() => {
              scrollToTop();
            }, 100);
          } else {
            setShowNewMessages(true);
          }
          
          // Fetch profile for new user - update state for reactivity
          const userId = payload.new.user_id;
          if (!profiles[userId]) {
            supabase
              .from('profiles')
              .select('user_id, display_name, username, avatar_url')
              .eq('user_id', userId)
              .single()
              .then(({ data }) => {
                if (data) {
                  setProfiles(prev => ({ ...prev, [userId]: data }));
                }
              });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [huddleId, isNearTop, scrollToTop]);

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
      {/* New Messages Pill - shows when scrolled away from top */}
      {showNewMessages && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20">
          <Button
            size="sm"
            onClick={() => scrollToTop()}
            className="bg-primary text-primary-foreground shadow-lg rounded-full px-4 py-2 text-sm font-medium animate-in fade-in slide-in-from-bottom-2"
          >
            <ChevronUp className="h-4 w-4 mr-1" />
            New messages
          </Button>
        </div>
      )}

      {/* Messages Area - scrollable, TOP-DOWN (newest at top) */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-2 pb-36"
        onScroll={handleScroll}
      >
        {messages.map((msg, index) => {
          const prevMessage = index > 0 ? messages[index - 1] : null;
          
          // Show date divider when date changes (top-down: check if current differs from previous)
          // Since newest is first, we show divider when date changes going DOWN the list
          const showDateDivider = index === 0 || 
            (prevMessage?.created_at && msg.created_at && 
             !isSameDay(new Date(msg.created_at), new Date(prevMessage.created_at)));

          return (
            <React.Fragment key={msg.id}>
              {showDateDivider && <DateDivider date={new Date(msg.created_at)} />}
              <ChatMessage
                message={msg}
                profile={profiles[msg.user_id]}
                isOwn={msg.user_id === user?.id}
                reactionCounts={reactionCounts[msg.id] || {}}
                onReaction={(emoji) => handleReaction(msg.id, emoji)}
                sponsor={getSponsorForMessage(msg)}
                badge={userBadges[msg.user_id] || null}
                onBadgeClick={onBadgeClick}
              />
            </React.Fragment>
          );
        })}
        
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            Be the first to say something!
          </div>
        )}
      </div>
    </div>
  );
});

// Export the handleSendMessage for external use
export type { Message, Profile };
