import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Plus, ChevronDown, ChevronRight, Bot, Users, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { StartHuddleDialog } from '@/components/StartHuddleDialog';
import { useToast } from '@/hooks/use-toast';
import { VerifiedBadge } from '@/components/VerifiedBadge';

interface Huddle {
  id: string;
  name: string;
  team_name: string;
  team_logo_url: string;
  participant_count: number;
  is_verified?: boolean;
  latest_message?: {
    content: string;
    created_at: string;
    is_bot_message?: boolean;
  };
  unread_count?: number;
}

interface TeamGroup {
  team_name: string;
  team_logo_url: string;
  huddles: Huddle[];
  isExpanded: boolean;
}

export const HuddleList = () => {
  const [teamGroups, setTeamGroups] = useState<TeamGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const toggleTeamExpansion = (teamName: string) => {
    setTeamGroups(prev => 
      prev.map(group => 
        group.team_name === teamName 
          ? { ...group, isExpanded: !group.isExpanded }
          : group
      )
    );
  };

  const fetchHuddles = async () => {
    if (!user) return;

    try {
      // Fetch user's huddles from database with latest message and member counts
      const { data: huddles, error } = await supabase
        .from('huddles')
        .select(`
          id,
          name,
          member_count,
          last_message_at,
          is_verified,
          teams (
            name,
            city,
            logo_url
          )
        `)
        .or(`owner_id.eq.${user.id},id.in.(${
          // Subquery to get huddles where user is a member
          await supabase
            .from('huddle_members')
            .select('huddle_id')
            .eq('user_id', user.id)
            .then(({ data }) => data?.map(m => m.huddle_id).join(',') || 'null')
        })`)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (error) throw error;

      // Get latest messages and unread counts for each huddle
      const huddleIds = huddles?.map(h => h.id) || [];
      const { data: latestMessages } = await supabase
        .from('huddle_messages')
        .select(`
          huddle_id,
          content,
          created_at,
          is_bot_message,
          is_team_agent_message,
          origin_teams:teams!origin_team_id(name)
        `)
        .in('huddle_id', huddleIds)
        .order('created_at', { ascending: false });

      // Get actual member counts
      const { data: memberCounts } = await supabase
        .from('huddle_members')
        .select('huddle_id')
        .in('huddle_id', huddleIds);

      // Get unread counts for user
      const { data: unreadData } = await supabase
        .from('huddle_members')
        .select('huddle_id, last_read_at')
        .eq('user_id', user.id)
        .in('huddle_id', huddleIds);

      const { data: unreadMessages } = await supabase
        .from('huddle_messages')
        .select('huddle_id, created_at')
        .in('huddle_id', huddleIds);

      // Calculate unread counts
      const unreadCounts: Record<string, number> = {};
      
      if (unreadData && unreadMessages) {
        unreadData.forEach(member => {
          const lastReadTime = member.last_read_at ? new Date(member.last_read_at) : new Date(0);
          const unreadCount = unreadMessages.filter(msg => 
            msg.huddle_id === member.huddle_id && 
            new Date(msg.created_at) > lastReadTime
          ).length;
          unreadCounts[member.huddle_id] = unreadCount;
        });
      }

      // Transform data to match our interface
      const transformedHuddles: Huddle[] = (huddles || []).map(huddle => {
        // Get actual member count from database
        const actualMemberCount = memberCounts?.filter(mc => mc.huddle_id === huddle.id).length || 1;
        
        // Get latest message for this huddle
        const latestMessage = latestMessages?.find(msg => msg.huddle_id === huddle.id);
        
        return {
          id: huddle.id,
          name: huddle.name,
          team_name: `${huddle.teams?.city} ${huddle.teams?.name}`,
          team_logo_url: huddle.teams?.logo_url || '/lovable-uploads/4520766b-9c2a-467d-a68c-44031ab9f4ba.png',
          participant_count: actualMemberCount,
          is_verified: huddle.is_verified,
          latest_message: latestMessage ? {
            content: latestMessage.content,
            created_at: latestMessage.created_at,
            is_bot_message: latestMessage.is_bot_message || latestMessage.is_team_agent_message
          } : undefined,
          unread_count: unreadCounts[huddle.id] || 0
        };
      });

      // Group by team
      const grouped = transformedHuddles.reduce((acc, huddle) => {
        const existing = acc.find(g => g.team_name === huddle.team_name);
        if (existing) {
          existing.huddles.push(huddle);
        } else {
          acc.push({
            team_name: huddle.team_name,
            team_logo_url: huddle.team_logo_url,
            huddles: [huddle],
            isExpanded: true
          });
        }
        return acc;
      }, [] as TeamGroup[]);

      setTeamGroups(grouped);
    } catch (error) {
      console.error('Error fetching huddles:', error);
      toast({
        title: "Error",
        description: "Failed to load huddles",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHuddles();
  }, [user]);

  const handleHuddlePress = (huddle: Huddle) => {
    navigate(`/huddle/${huddle.id}`);
  };

  const handleCreateHuddle = () => {
    setShowCreateDialog(true);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading huddles...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Header with create button and settings */}
      <div className="px-4 py-3 border-b border-white/10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Your Huddles</h2>
          <div className="flex items-center gap-2">
            {userRole === 'admin' && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => navigate('/admin')}
                className="rounded-full h-8 w-8 p-0"
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}
            <StartHuddleDialog 
              onHuddleCreated={fetchHuddles}
              trigger={
                <Button
                  size="sm"
                  className="bg-primary hover:bg-primary/90 rounded-full h-8 w-8 p-0"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              }
            />
          </div>
        </div>
      </div>

      {/* Huddle list */}
      <div className="flex-1 overflow-y-auto pb-28">
        {teamGroups.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">No huddles yet</h3>
            <p className="text-muted-foreground mb-4">Create your first huddle to start chatting with friends</p>
            <StartHuddleDialog 
              onHuddleCreated={fetchHuddles}
              trigger={
                <Button className="bg-primary hover:bg-primary/90">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Huddle
                </Button>
              }
            />
          </div>
        ) : (
          <div className="space-y-1">
            {teamGroups.map((group) => (
              <div key={group.team_name}>
                {/* Team header */}
                <button
                  onClick={() => toggleTeamExpansion(group.team_name)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={group.team_logo_url} alt={group.team_name} />
                    <AvatarFallback className="bg-muted text-xs">
                      {group.team_name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-foreground flex-1 text-left">
                    {group.team_name}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {group.huddles.length}
                  </Badge>
                  {group.isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>

                {/* Huddles for this team */}
                {group.isExpanded && (
                  <div className="space-y-1">
                    {group.huddles.map((huddle) => (
                      <button
                        key={huddle.id}
                        onClick={() => handleHuddlePress(huddle)}
                        className="w-full px-4 pl-16 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-foreground text-sm">
                              {huddle.name}
                            </span>
                            {huddle.is_verified && (
                              <VerifiedBadge size="sm" />
                            )}
                            <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                              <Users className="h-3 w-3" />
                              <span>{huddle.participant_count}</span>
                            </div>
                          </div>
                          {huddle.latest_message && (
                            <div className="flex items-center gap-2">
                              {huddle.latest_message.is_bot_message && (
                                <Bot className="h-3 w-3 text-accent shrink-0" />
                              )}
                              <p className="text-xs text-muted-foreground truncate">
                                {huddle.latest_message.content}
                              </p>
                              <span className="text-xs text-muted-foreground shrink-0">
                                {formatDistanceToNow(new Date(huddle.latest_message.created_at), { addSuffix: true })}
                              </span>
                            </div>
                          )}
                        </div>
                        {huddle.unread_count && huddle.unread_count > 0 && (
                          <Badge 
                            variant="destructive" 
                            className="h-5 w-5 p-0 text-xs flex items-center justify-center"
                          >
                            {huddle.unread_count > 99 ? '99+' : huddle.unread_count}
                          </Badge>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};