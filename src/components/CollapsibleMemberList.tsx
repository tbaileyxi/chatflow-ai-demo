import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Users } from 'lucide-react';

interface Member {
  user_id: string;
  profiles: {
    display_name?: string;
    username?: string;
    avatar_url?: string;
  } | null;
  online: boolean;
}

interface CollapsibleMemberListProps {
  huddleId: string;
}

export const CollapsibleMemberList = ({ huddleId }: CollapsibleMemberListProps) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMembers();
  }, [huddleId]);

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('huddle_members')
        .select(`
          user_id
        `)
        .eq('huddle_id', huddleId);

      if (error) throw error;

      if (!data) return;

      // Get profiles separately
      const uniqueUserIds = [...new Set(data.map(m => m.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, username, avatar_url')
        .in('user_id', uniqueUserIds);

      // Mock online status for now (in a real app, you'd use presence or last_seen)
      const membersWithStatus = uniqueUserIds.map(userId => ({
        user_id: userId,
        profiles: profiles?.find(p => p.user_id === userId) || null,
        online: Math.random() > 0.5 // Mock online status
      }));

      setMembers(membersWithStatus);
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return null;

  const onlineMembers = members.filter(m => m.online);
  const offlineMembers = members.filter(m => !m.online);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between p-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span className="text-sm font-medium">
              Members ({members.length})
            </span>
            {onlineMembers.length > 0 && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-xs text-muted-foreground">{onlineMembers.length} online</span>
              </div>
            )}
          </div>
          {isOpen ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 p-2">
        {onlineMembers.length > 0 && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              Online ({onlineMembers.length})
            </div>
            {onlineMembers.map((member) => (
              <div key={member.user_id} className="flex items-center gap-2 p-1 rounded hover:bg-accent/50">
                <div className="relative">
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={member.profiles?.avatar_url} />
                    <AvatarFallback className="text-xs">
                      {(member.profiles?.display_name || member.profiles?.username)?.substring(0, 2).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-background"></div>
                </div>
                <span className="text-sm">
                  {member.profiles?.display_name || member.profiles?.username || 'Anonymous'}
                </span>
              </div>
            ))}
          </div>
        )}
        {offlineMembers.length > 0 && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">
              Offline ({offlineMembers.length})
            </div>
            {offlineMembers.map((member) => (
              <div key={member.user_id} className="flex items-center gap-2 p-1 rounded hover:bg-accent/50">
                <Avatar className="w-6 h-6">
                  <AvatarImage src={member.profiles?.avatar_url} />
                  <AvatarFallback className="text-xs">
                    {(member.profiles?.display_name || member.profiles?.username)?.substring(0, 2).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-muted-foreground">
                  {member.profiles?.display_name || member.profiles?.username || 'Anonymous'}
                </span>
              </div>
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};