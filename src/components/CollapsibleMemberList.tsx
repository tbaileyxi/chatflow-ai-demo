import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
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
  joined_at: string;
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
  const { onlineMembers } = usePresence(huddleId);

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
        online: onlineMembers.some(u => u.user_id === userId) || userId === huddleData.owner_id,
        joined_at: new Date().toISOString() // Add this for compatibility
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

  const onlineCount = members.filter(m => m.online).length;
  const huddle = { owner_id: ownerId }; // Add this for compatibility

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 gap-2 bg-team-primary/20 border border-team-primary/40 hover:bg-team-primary/30 text-team-primary font-pixel"
          disabled={loading}
        >
          <Users className="h-4 w-4" />
          <span className="text-sm font-medium">
            {loading ? '...' : `${onlineCount} online`}
          </span>
          <ChevronDown className={cn(
            "h-3 w-3 transition-transform duration-200",
            isOpen && "rotate-180"
          )} />
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="absolute top-full right-0 z-50 mt-1">
        <Card className="w-72 max-h-96 overflow-y-auto bg-background/95 backdrop-blur-sm border-team-primary/30 shadow-lg">
          <div className="p-4">
            <h3 className="font-orbitron font-semibold text-sm text-team-primary mb-3">
              Huddle Members ({members.length})
            </h3>
            <div className="space-y-2">
              {members.map((member) => {
                const isOnline = member.online;
                return (
                  <div key={member.user_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-team-primary/10 transition-colors">
                    <div className="relative">
                      <Avatar className="h-8 w-8 border border-team-primary/30">
                        <AvatarImage src={member.profiles?.avatar_url} />
                        <AvatarFallback className="text-xs bg-team-primary/20 text-team-primary">
                          {(member.profiles?.display_name?.[0] || 
                            member.profiles?.username?.[0] || 
                            'U').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {isOnline && (
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-background rounded-full animate-pulse" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate font-exo2">
                        {member.profiles?.display_name || member.profiles?.username || 'Anonymous'}
                        {isOnline && <span className="ml-2 text-xs text-green-500">●</span>}
                      </p>
                      <p className="text-xs text-muted-foreground font-pixel">
                        Joined {formatDistanceToNow(new Date(member.joined_at), { addSuffix: true })}
                      </p>
                    </div>
                    {member.user_id === huddle?.owner_id && (
                      <Badge variant="secondary" className="text-xs bg-team-secondary/20 text-team-secondary border-team-secondary/40">
                        Owner
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
};