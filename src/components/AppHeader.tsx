import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';

interface OnlineStatus {
  totalMembers: number;
  onlineMembers: number;
  hasUnread: boolean;
}

export const AppHeader = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [onlineStatus, setOnlineStatus] = useState<OnlineStatus>({
    totalMembers: 0,
    onlineMembers: 0,
    hasUnread: false
  });

  useEffect(() => {
    if (!user) return;

    const fetchOnlineStatus = async () => {
      try {
        // Get user's huddles
        const { data: memberData } = await supabase
          .from('huddle_members')
          .select(`
            huddle:huddles(id, name, owner_id),
            last_read_at
          `)
          .eq('user_id', user.id);

        if (!memberData?.length) {
          setOnlineStatus({ totalMembers: 0, onlineMembers: 0, hasUnread: false });
          return;
        }

        let totalMembers = 0;
        let othersOnlineCount = 0;
        let hasUnread = false;

        // Process each huddle
        for (const member of memberData) {
          // Get all members in huddle
          const { data: huddleMembers } = await supabase
            .from('huddle_members')
            .select('user_id')
            .eq('huddle_id', member.huddle.id);

          // Get profiles for online status (last login within 30 minutes = online)
          const cutoffTime = new Date(Date.now() - 30 * 60 * 1000).toISOString();
          const { data: onlineProfiles } = await supabase
            .from('profiles')
            .select('user_id')
            .in('user_id', huddleMembers?.map(m => m.user_id) || [])
            .gte('last_login_at', cutoffTime);

          // Check for unread messages
          const { count: unreadCount } = await supabase
            .from('huddle_messages')
            .select('*', { count: 'exact', head: true })
            .eq('huddle_id', member.huddle.id)
            .gt('created_at', member.last_read_at || '1970-01-01');

          const huddleMemberCount = huddleMembers?.length || 0;
          const huddleOnlineCount = onlineProfiles?.length || 0;
          
          // Count others online (excluding current user)
          const othersOnline = Math.max(0, huddleOnlineCount - (onlineProfiles?.some(p => p.user_id === user.id) ? 1 : 0));

          totalMembers += huddleMemberCount;
          othersOnlineCount += othersOnline;
          
          if ((unreadCount || 0) > 0) {
            hasUnread = true;
          }
        }

        setOnlineStatus({ 
          totalMembers, 
          onlineMembers: othersOnlineCount, // This now represents "others online" not including current user
          hasUnread 
        });
      } catch (error) {
        console.error('Error fetching online status:', error);
      }
    };

    fetchOnlineStatus();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchOnlineStatus, 30000);
    
    return () => clearInterval(interval);
  }, [user]);

  const handleChatClick = () => {
    // Navigate to the first available huddle or app page
    navigate('/app');
  };

  const isOnMainPage = location.pathname === '/app';

  return (
    <header className="h-16 bg-background border-b border-border flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold text-foreground">Side Huddle</h1>
        
        {/* Chat icon positioned on left */}
        <Button
          variant={isOnMainPage ? "default" : "ghost"}
          size="sm"
          onClick={handleChatClick}
          className={`flex items-center gap-2 relative transition-colors ${
            onlineStatus.hasUnread ? 'animate-pulse' : ''
          } ${onlineStatus.onlineMembers > 0 ? 'bg-yellow-500/20 text-yellow-600 hover:bg-yellow-500/30 border-yellow-500/50' : ''}`}
        >
          <MessageSquare 
            className={`w-4 h-4 ${
              onlineStatus.onlineMembers > 0 ? 'text-yellow-600' : 'text-muted-foreground'
            }`} 
          />
          <span className="hidden sm:inline">Chat</span>
          
          {/* Online indicator */}
          {onlineStatus.onlineMembers > 0 && (
            <div className="absolute -top-1 -right-1 flex items-center gap-1">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
            </div>
          )}
          
          {/* Unread indicator */}
          {onlineStatus.hasUnread && (
            <Badge variant="destructive" className="absolute -top-2 -right-2 w-2 h-2 p-0 text-xs">
              
            </Badge>
          )}
        </Button>

        {/* Online status display */}
        {onlineStatus.totalMembers > 0 && (
          <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="w-3 h-3" />
            <span>{onlineStatus.onlineMembers} online</span>
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        {/* Empty div for right side - can add profile/settings later */}
      </div>
    </header>
  );
};