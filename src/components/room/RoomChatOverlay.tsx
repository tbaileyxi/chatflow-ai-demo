import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, useDragControls, PanInfo } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { RoomChatInput } from '@/components/room/RoomChatInput';
import { RoomMessageBubble } from '@/components/room/RoomMessageBubble';
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
  profile?: {
    display_name: string;
    username: string;
    avatar_url: string;
  };
}

interface ReactionCount {
  [emoji: string]: number;
}

interface RoomChatOverlayProps {
  huddleId: string;
  height: number;
  onHeightChange: (height: number) => void;
  onLastMessageChange: (messageId: string | null) => void;
  onSelectedTargetChange?: (messageId: string | null) => void;
  isLive: boolean;
  eventName?: string;
  team1Name?: string;
  team2Name?: string;
  score1?: number | null;
  score2?: number | null;
}

export function RoomChatOverlay({
  huddleId,
  height,
  onHeightChange,
  onLastMessageChange,
  onSelectedTargetChange,
  isLive,
  eventName,
  team1Name,
  team2Name,
  score1,
  score2
}: RoomChatOverlayProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [reactionCounts, setReactionCounts] = useState<Record<string, ReactionCount>>({});
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  // Quick bar height for padding
  const quickBarHeight = 80;

  // Fetch messages (newest at top = descending order)
  const fetchMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from('huddle_messages')
      .select('*')
      .eq('huddle_id', huddleId)
      .not('message_type', 'in', '("social_buzz","highlight","pulse")')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching messages:', error);
      return;
    }

    setMessages(data || []);
    
    // Update last message ID and set as default selected
    if (data && data.length > 0) {
      onLastMessageChange(data[0].id);
      if (!selectedMessageId) {
        setSelectedMessageId(data[0].id);
        onSelectedTargetChange?.(data[0].id);
      }
    }

    // Fetch profiles
    const userIds = [...new Set((data || []).map(m => m.user_id))];
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, display_name, username, avatar_url')
        .in('user_id', userIds);
      
      const profileMap: Record<string, any> = {};
      (profilesData || []).forEach(p => {
        profileMap[p.user_id] = p;
      });
      setProfiles(profileMap);
    }

    // Fetch reaction counts for all messages
    const messageIds = (data || []).map(m => m.id);
    if (messageIds.length > 0) {
      const { data: reactions } = await supabase
        .from('huddle_message_reactions')
        .select('message_id, emoji')
        .in('message_id', messageIds);

      const counts: Record<string, ReactionCount> = {};
      (reactions || []).forEach(r => {
        if (!counts[r.message_id]) counts[r.message_id] = {};
        counts[r.message_id][r.emoji] = (counts[r.message_id][r.emoji] || 0) + 1;
      });
      setReactionCounts(counts);
    }
  }, [huddleId, onLastMessageChange, onSelectedTargetChange, selectedMessageId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtime subscription for messages
  useEffect(() => {
    const channel = supabase
      .channel(`room-chat-${huddleId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'huddle_messages',
          filter: `huddle_id=eq.${huddleId}`
        },
        (payload) => {
          if (!['social_buzz', 'highlight', 'pulse'].includes(payload.new.message_type)) {
            setMessages(prev => [payload.new as Message, ...prev]);
            onLastMessageChange(payload.new.id);
            
            // Auto-select newest message as reaction target
            setSelectedMessageId(payload.new.id);
            onSelectedTargetChange?.(payload.new.id);
            
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
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [huddleId, profiles, onLastMessageChange, onSelectedTargetChange]);

  // Realtime subscription for reactions
  useEffect(() => {
    const channel = supabase
      .channel(`room-reactions-${huddleId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'huddle_message_reactions'
        },
        (payload) => {
          const { message_id, emoji } = payload.new;
          setReactionCounts(prev => ({
            ...prev,
            [message_id]: {
              ...(prev[message_id] || {}),
              [emoji]: ((prev[message_id]?.[emoji]) || 0) + 1
            }
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [huddleId]);

  // Handle drag to resize
  const handleDrag = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const viewportHeight = window.innerHeight;
    const deltaPercent = (info.delta.y / viewportHeight) * -100;
    const newHeight = Math.max(30, Math.min(90, height + deltaPercent));
    onHeightChange(newHeight);
  };

  // Handle message selection for reactions
  const handleMessageSelect = useCallback((messageId: string) => {
    setSelectedMessageId(messageId);
    onSelectedTargetChange?.(messageId);
  }, [onSelectedTargetChange]);

  // Send message
  const handleSendMessage = async (content: string, mediaUrl?: string) => {
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
  };

  return (
    <motion.div
      className={cn(
        "fixed left-0 right-0 z-40",
        "bg-background/95 backdrop-blur-md",
        "rounded-t-3xl border-t border-border/50",
        "shadow-2xl shadow-black/20",
        "flex flex-col"
      )}
      style={{ 
        height: `${height}vh`,
        bottom: quickBarHeight
      }}
      drag="y"
      dragControls={dragControls}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0}
      onDrag={handleDrag}
    >
      {/* Drag Handle */}
      <div 
        className="flex justify-center py-2 cursor-grab active:cursor-grabbing flex-shrink-0"
        onPointerDown={(e) => dragControls.start(e)}
      >
        <div className="w-12 h-1 rounded-full bg-muted-foreground/30" />
      </div>

      {/* Messages Area (scrollable, takes remaining space) */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-2 min-h-0"
      >
        {messages.map((msg) => (
          <div 
            key={msg.id}
            onClick={() => handleMessageSelect(msg.id)}
            className={cn(
              "cursor-pointer transition-all",
              selectedMessageId === msg.id && "ring-2 ring-primary/50 rounded-xl"
            )}
          >
            <RoomMessageBubble
              message={msg}
              profile={profiles[msg.user_id]}
              isOwn={msg.user_id === user?.id}
              isCoach={msg.message_type === 'coach_response'}
              reactionCounts={reactionCounts[msg.id]}
            />
          </div>
        ))}
        
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            Be the first to say something!
          </div>
        )}
      </div>

      {/* Chat Input - PINNED AT BOTTOM of overlay */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-border/30 bg-background/80">
        <RoomChatInput
          huddleId={huddleId}
          userId={user?.id}
          onSendMessage={handleSendMessage}
          disabled={!user}
          placeholder="Say something..."
        />
      </div>
    </motion.div>
  );
}
