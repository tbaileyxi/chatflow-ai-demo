import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Users } from 'lucide-react';
import { usePresence } from '@/hooks/usePresence';
import { useAuth } from '@/hooks/useAuth';

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
  ownerId?: string;
}

export const CollapsibleMemberList = ({ huddleId, ownerId }: CollapsibleMemberListProps) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { onlineUsers, onlineCount } = usePresence(`huddle:${huddleId}`, user?.id);

  useEffect(() => {
    fetchMembers();
  }, [huddleId]);

  const fetchMembers = async () => {
    try {
      // Get all huddle members including the owner
      const { data: memberData, error: memberError } = await supabase
        .from('huddle_members')
        .select('user_id')
        .eq('huddle_id', huddleId);

      if (memberError) throw memberError;

      // Get owner info from huddles table
      const { data: huddleData, error: huddleError } = await supabase
        .from('huddles')
        .select('owner_id')
        .eq('id', huddleId)
        .single();

      if (huddleError) throw huddleError;

      // Combine all user IDs (members + owner, remove duplicates)
      const memberIds = memberData?.map(m => m.user_id) || [];
      const allUserIds = [...new Set([...memberIds, huddleData.owner_id])];

      // Get profiles for all users
      const profilePromises = allUserIds.map(userId => 
        supabase.rpc('get_public_profile', { target_user_id: userId })
      );
      const profileResults = await Promise.all(profilePromises);
      const profiles = profileResults.map(result => result.data?.[0]).filter(Boolean);

      // Use real presence data
      const membersWithStatus = allUserIds.map(userId => ({
        user_id: userId,
        profiles: profiles?.find(p => p.user_id === userId) || null,
        online: onlineUsers.some(u => u.user_id === userId) || userId === huddleData.owner_id
      }));

      console.log(`Huddle ${huddleId} - Fetched ${membersWithStatus.length} members:`, 
        membersWithStatus.map(m => ({ 
          id: m.user_id, 
          name: m.profiles?.display_name || 'Unknown', 
          isOwner: m.user_id === huddleData.owner_id,
          online: m.online 
        }))
      );

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
                <span className="text-xs text-muted-foreground">{onlineMembers.length}</span>
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
                  {member.user_id === ownerId && (
                    <span className="text-xs italic text-muted-foreground ml-1">(owner)</span>
                  )}
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
                  {member.user_id === ownerId && (
                    <span className="text-xs italic text-muted-foreground ml-1">(owner)</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};