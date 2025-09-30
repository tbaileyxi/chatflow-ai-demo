import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PresenceState {
  user_id: string;
  display_name?: string;
  avatar_url?: string;
  online_at: string;
}

export const usePresence = (channelName: string, userId?: string) => {
  const [onlineUsers, setOnlineUsers] = useState<PresenceState[]>([]);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel(channelName);
    channelRef.current = channel;

    // Subscribe to presence changes
    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState();
        const users: PresenceState[] = [];
        
        Object.keys(newState).forEach(key => {
          const presences = newState[key] as any[];
          if (presences.length > 0) {
            const presence = presences[0];
            if (presence.user_id && presence.online_at) {
              users.push(presence as PresenceState);
            }
          }
        });
        
        setOnlineUsers(users);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', key, leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track user presence
          const userStatus = {
            user_id: userId,
            online_at: new Date().toISOString(),
          };

          await channel.track(userStatus);
        }
      });

    // Cleanup function
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [channelName, userId]);

  // Update user activity on interactions
  const updateActivity = () => {
    if (channelRef.current) {
      channelRef.current.track({
        user_id: userId,
        online_at: new Date().toISOString(),
      });
    }
  };

  return {
    onlineUsers,
    onlineMembers: onlineUsers,
    updateActivity,
    onlineCount: onlineUsers.length
  };
};