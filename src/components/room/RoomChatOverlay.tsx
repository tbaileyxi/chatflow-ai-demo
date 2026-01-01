import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, useDragControls, PanInfo } from 'framer-motion';
import { GripHorizontal } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { RetroChatInput } from '@/components/retro/RetroChatInput';
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

interface RoomChatOverlayProps {
  huddleId: string;
  height: number;
  onHeightChange: (height: number) => void;
  onLastMessageChange: (messageId: string | null) => void;
  isLive: boolean;
}

export function RoomChatOverlay({
  huddleId,
  height,
  onHeightChange,
  onLastMessageChange,
  isLive
}: RoomChatOverlayProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  // Fetch messages (newest at top = descending order)
  const fetchMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from('huddle_messages')
      .select('*')
      .eq('huddle_id', huddleId)
      .not('message_type', 'in', '("social_buzz","highlight","pulse")') // Exclude pulse items
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching messages:', error);
      return;
    }

    setMessages(data || []);
    
    // Update last message ID
    if (data && data.length > 0) {
      onLastMessageChange(data[0].id);
    }

    // Fetch profiles for all unique user_ids
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
  }, [huddleId, onLastMessageChange]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtime subscription
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
          // Only add if not a pulse message
          if (!['social_buzz', 'highlight', 'pulse'].includes(payload.new.message_type)) {
            setMessages(prev => [payload.new as Message, ...prev]);
            onLastMessageChange(payload.new.id);
            
            // Fetch profile if not cached
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
  }, [huddleId, profiles, onLastMessageChange]);

  // Handle drag to resize
  const handleDrag = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const viewportHeight = window.innerHeight;
    const deltaPercent = (info.delta.y / viewportHeight) * -100;
    const newHeight = Math.max(30, Math.min(90, height + deltaPercent));
    onHeightChange(newHeight);
  };

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

  // Account for quick bar height (approx 80px + safe area)
  const quickBarHeight = 80;

  return (
    <motion.div
      className={cn(
        "fixed left-0 right-0 z-40",
        "bg-background/95 backdrop-blur-md",
        "rounded-t-3xl border-t border-border/50",
        "shadow-2xl shadow-black/20"
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
        className="flex justify-center py-2 cursor-grab active:cursor-grabbing"
        onPointerDown={(e) => dragControls.start(e)}
      >
        <div className="w-12 h-1 rounded-full bg-muted-foreground/30" />
      </div>

      {/* Pinned Input at Top */}
      <div className="px-4 pb-2 border-b border-border/30">
        <RetroChatInput
          onSendMessage={handleSendMessage}
          placeholder="Say something..."
          disabled={!user}
          huddleId={huddleId}
          userId={user?.id}
        />
      </div>

      {/* Messages (Newest at Top) */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto px-4 py-2"
        style={{ height: `calc(100% - 100px)` }}
      >
        {messages.map((msg, index) => (
          <RoomMessageBubble
            key={msg.id}
            message={msg}
            profile={profiles[msg.user_id]}
            isOwn={msg.user_id === user?.id}
            isCoach={msg.message_type === 'coach_response'}
          />
        ))}
        
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            Be the first to say something!
          </div>
        )}
      </div>
    </motion.div>
  );
}
