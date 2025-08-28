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

  // Setup optimized real-time subscriptions with debounce and typing lock
  useEffect(() => {
    if (!huddleId) return;

    cleanupChannels();

    if (batchUpdaterRef.current) {
      batchUpdaterRef.current.destroy();
    }
    batchUpdaterRef.current = new BatchUpdater(debouncedUpdate, 5, isTyping ? 800 : 150);

    console.log('[Realtime] Subscribing for huddle', huddleId);

    const messageChannel = supabase
      .channel(`optimized-huddle-${huddleId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'huddle_messages', filter: `huddle_id=eq.${huddleId}` },
        async (payload) => {
          const newMessage = payload.new as Message;
          if (newMessage.user_id) {
            try {
              const { data: profile } = await supabase.rpc('get_public_profile', { target_user_id: newMessage.user_id });
              newMessage.profiles = Array.isArray(profile) ? profile[0] : profile;
            } catch {}
          }
          if (!isTypingLockRef.current) {
            onNewMessage(newMessage);
          } else {
            batchUpdaterRef.current?.add(newMessage);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'huddle_messages', filter: `huddle_id=eq.${huddleId}` },
        (payload) => {
          batchUpdaterRef.current?.add(payload.new as any);
        }
      )
      .subscribe();

    channelsRef.current = [messageChannel];

    return () => {
      cleanupChannels();
      if (batchUpdaterRef.current) batchUpdaterRef.current.destroy();
    };
  }, [huddleId, debouncedUpdate, cleanupChannels, onNewMessage, isTyping]);

  return null;
};