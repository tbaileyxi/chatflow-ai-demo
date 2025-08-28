import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BatchUpdater, useDebounce } from '@/utils/performance';
import { useIOSKeyboard } from '@/hooks/useIOSKeyboard';

interface Message {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  [key: string]: any;
}

interface RealtimeMessageHandlerProps {
  huddleId: string;
  onNewMessage: (message: Message) => void;
  onMessagesUpdate: (messages: Message[]) => void;
  userId?: string;
}

export const RealtimeMessageHandler = ({
  huddleId,
  onNewMessage,
  onMessagesUpdate,
  userId
}: RealtimeMessageHandlerProps) => {
  const batchUpdaterRef = useRef<BatchUpdater>();
  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([]);
  const { isTyping } = useIOSKeyboard();
  const isTypingLockRef = useRef(false);

  // Much longer debounce when user is typing to prevent iOS scroll jumps
  const debouncedUpdate = useDebounce((messages: Message[]) => {
    if (!isTypingLockRef.current) {
      onMessagesUpdate(messages);
    }
  }, isTyping ? 800 : 100);

  // Lock updates during typing
  useEffect(() => {
    console.log('[Realtime] Typing state changed:', { isTyping });
    if (isTyping) {
      console.log('[Realtime] Activating typing lock');
      isTypingLockRef.current = true;
    } else {
      // Release lock shortly after typing stops
      const timer = setTimeout(() => {
        isTypingLockRef.current = false;
        console.log('[Realtime] Typing lock released');
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isTyping]);

  // Cleanup function for channels
  const cleanupChannels = useCallback(() => {
    channelsRef.current.forEach(channel => {
      supabase.removeChannel(channel);
    });
    channelsRef.current = [];
  }, []);

  // Setup real-time message subscription
  useEffect(() => {
    if (!huddleId) return;

    console.log('[Realtime] Setting up subscription for huddle:', huddleId);
    
    const channel = supabase
      .channel(`huddle-${huddleId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'huddle_messages',
          filter: `huddle_id=eq.${huddleId}`
        },
        (payload) => {
          console.log('[Realtime] New message payload', payload);
          if (payload.new && !isTypingLockRef.current) {
            onNewMessage(payload.new as Message);
          }
        }
      )
      .subscribe();

    channelsRef.current.push(channel);

    return () => {
      cleanupChannels();
    };
  }, [huddleId, onNewMessage, cleanupChannels]);

  return null;
};