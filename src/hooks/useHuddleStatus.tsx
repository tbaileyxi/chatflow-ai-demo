import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface HuddleStatus {
  totalMembers: number;
  onlineMembers: number;
  hasUnread: boolean;
}

export const useHuddleStatus = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState<HuddleStatus>({ 
    totalMembers: 0, 
    onlineMembers: 0, 
    hasUnread: false 
  });

  const fetchHuddleStatus = async () => {
    if (!user) return;

    try {
      const { data: memberData } = await supabase
        .from('huddle_members')
        .select(`
          huddle:huddles(id, name, owner_id),
          last_read_at
        `)
        .eq('user_id', user.id);

      if (!memberData?.length) {
        setStatus({ totalMembers: 0, onlineMembers: 0, hasUnread: false });
        return;
      }

      let totalMembers = 0;
      let othersOnlineCount = 0;
      let hasUnread = false;

      for (const member of memberData) {
        const { data: huddleMembers } = await supabase
          .from('huddle_members')
          .select('user_id')
          .eq('huddle_id', member.huddle.id);

        const cutoffTime = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        const { data: onlineProfiles } = await supabase
          .from('profiles')
          .select('user_id')
          .in('user_id', huddleMembers?.map(m => m.user_id) || [])
          .gte('last_login_at', cutoffTime);

        const { count: unreadCount } = await supabase
          .from('huddle_messages')
          .select('*', { count: 'exact', head: true })
          .eq('huddle_id', member.huddle.id)
          .gt('created_at', member.last_read_at || '1970-01-01');

        const huddleOnlineCount = onlineProfiles?.length || 0;
        const othersOnline = Math.max(0, huddleOnlineCount - (onlineProfiles?.some(p => p.user_id === user.id) ? 1 : 0));

        totalMembers += huddleMembers?.length || 0;
        othersOnlineCount += othersOnline;
        if ((unreadCount || 0) > 0) hasUnread = true;
      }

      setStatus({ totalMembers, onlineMembers: othersOnlineCount, hasUnread });
    } catch (error) {
      console.error('Error fetching huddle status:', error);
    }
  };

  useEffect(() => {
    if (!user) return;

    // Listen for custom event when huddle is read
    const handleHuddleRead = () => {
      fetchHuddleStatus();
    };

    fetchHuddleStatus();
    const interval = setInterval(fetchHuddleStatus, 30000);
    window.addEventListener('huddleRead', handleHuddleRead);
    
    // Set up realtime subscription for huddle updates
    const channel = supabase
      .channel('huddle-status-updates')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'huddle_messages' }, 
        () => fetchHuddleStatus()
      )
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'huddle_members' }, 
        () => fetchHuddleStatus()
      )
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'profiles' }, 
        () => fetchHuddleStatus()
      )
      .subscribe();
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('huddleRead', handleHuddleRead);
      supabase.removeChannel(channel);
    };
  }, [user]);

  return status;
};