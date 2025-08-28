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

  // Longer debounce when user is typing to prevent iOS scroll jumps
  const debouncedUpdate = useDebounce((messages: Message[]) => {
    onMessagesUpdate(messages);
  }, isTyping ? 500 : 100);

  // Cleanup function for channels
  const cleanupChannels = useCallback(() => {
    channelsRef.current.forEach(channel => {
      supabase.removeChannel(channel);
    });
    channelsRef.current = [];
  }, []);

  // Setup optimized real-time subscriptions
  useEffect(() => {
    if (!huddleId) return;

    // Cleanup existing channels
    cleanupChannels();

    // Initialize batch updater for message updates
    if (batchUpdaterRef.current) {
      batchUpdaterRef.current.destroy();
    }
    batchUpdaterRef.current = new BatchUpdater(debouncedUpdate, 5, 150);

    console.log('[Realtime] Setting up optimized subscriptions for huddle', huddleId);

    // Single channel for all message operations
    const messageChannel = supabase
      .channel(`optimized-huddle-${huddleId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'huddle_messages',
          filter: `huddle_id=eq.${huddleId}`
        },
        async (payload) => {
          console.log('[Realtime] New message received', payload);
          
          const newMessage = payload.new as Message;
          
          // Fetch profile data for new message
          if (newMessage.user_id) {
            try {
              const { data: profile } = await supabase.rpc('get_public_profile', {
                target_user_id: newMessage.user_id
              });
              newMessage.profiles = Array.isArray(profile) ? profile[0] : profile;
            } catch (error) {
              console.error('Error fetching profile for new message:', error);
            }
          }

          // Don't immediately update during typing on iOS to prevent jumps
          if (!isTyping) {
            onNewMessage(newMessage);
          } else {
            // Queue the message for later when typing stops
            if (batchUpdaterRef.current) {
              batchUpdaterRef.current.add(newMessage);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'huddle_messages',
          filter: `huddle_id=eq.${huddleId}`
        },
        (payload) => {
          console.log('[Realtime] Message updated', payload);
          // Batch message updates for better performance
          if (batchUpdaterRef.current) {
            batchUpdaterRef.current.add(payload.new);
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Message channel status:', status);
      });

    // Separate channel for reactions (less critical, more batched)
    const reactionChannel = supabase
      .channel(`reactions-${huddleId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'huddle_message_reactions'
        },
        (payload) => {
          console.log('[Realtime] Reaction update', payload);
          // Batch reaction updates
          if (batchUpdaterRef.current) {
            batchUpdaterRef.current.add({ type: 'reaction', data: payload });
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Reaction channel status:', status);
      });

    // Store channel references
    channelsRef.current = [messageChannel, reactionChannel];

    // Recovery mechanism for mobile apps
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('[Realtime] Page visible, checking connection status');
        // Resubscribe channels if needed
        channelsRef.current.forEach(channel => {
          if (channel.state === 'closed') {
            console.log('[Realtime] Resubscribing closed channel');
            channel.subscribe();
          }
        });
      }
    };

    const handleOnline = () => {
      console.log('[Realtime] Network online, resubscribing channels');
      cleanupChannels();
      // Re-run this effect to recreate channels
      setTimeout(() => {
        // Trigger re-subscription by updating a dependency
      }, 1000);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      cleanupChannels();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      
      if (batchUpdaterRef.current) {
        batchUpdaterRef.current.destroy();
      }
    };
  }, [huddleId, onNewMessage, debouncedUpdate]);

  return null; // This is a logic-only component
};