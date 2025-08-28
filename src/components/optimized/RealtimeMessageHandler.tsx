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

  // Temporarily disable all real-time updates to stop flashing
  useEffect(() => {
    console.log('[Realtime] Real-time updates disabled to prevent flashing');
    return () => {};
  }, [huddleId]);

  return null;
};