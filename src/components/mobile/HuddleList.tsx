import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, ChevronDown, Bot, Users, Settings, Globe, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

interface Huddle {
  id: string;
  name: string;
  team_name: string;
  team_logo_url: string;
  participant_count: number;
  is_verified?: boolean;
  is_official_team_huddle?: boolean;
  parent_team_id?: string;
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
}

export const HuddleList = () => {
  const [teamGroups, setTeamGroups] = useState<TeamGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const fetchHuddles = async () => {
    try {
      // Only show huddles where the user is a member
      if (!user) {
        setTeamGroups([]);
        setLoading(false);
        return;
      }

      // Get only huddles where user is an actual member
      const { data: membershipData, error: membershipError } = await supabase
        .from('huddle_members')
        .select(`
          huddle_id,
          huddles (
            id,
            name,
            member_count,
            last_message_at,
            is_verified,
            is_official_team_huddle,
            is_private,
            parent_team_id,
            owner_id,
            teams!team_id (
              name,
              city,
              logo_url
            )
          )
        `)
        .eq('user_id', user.id);

      if (membershipError) throw membershipError;

      // Extract huddles from membership data
      const huddles = membershipData
        ?.map(m => m.huddles)
        .filter(Boolean) || [];

      const error = null;

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
          is_team_agent_message
        `)
        .in('huddle_id', huddleIds)
        .order('created_at', { ascending: false });

      // Get actual member counts
      const { data: memberCounts } = await supabase
        .from('huddle_members')
        .select('huddle_id')
        .in('huddle_id', huddleIds);

      // Get unread counts for user (only if authenticated)
      let unreadCounts: Record<string, number> = {};
      
      if (user) {
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
      }

      // Transform data to match our interface
      const transformedHuddles: Huddle[] = (huddles || []).map(huddle => {
        const actualMemberCount = memberCounts?.filter(mc => mc.huddle_id === huddle.id).length || 1;
        const latestMessage = latestMessages?.find(msg => msg.huddle_id === huddle.id);
        
        return {
          id: huddle.id,
          name: huddle.name,
          team_name: `${huddle.teams?.city} ${huddle.teams?.name}`,
          team_logo_url: huddle.teams?.logo_url || '/lovable-uploads/4520766b-9c2a-467d-a68c-44031ab9f4ba.png',
          participant_count: actualMemberCount,
          is_verified: huddle.is_verified,
          is_official_team_huddle: huddle.is_official_team_huddle,
          parent_team_id: huddle.parent_team_id,
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
            huddles: [huddle]
          });
        }
        return acc;
      }, [] as TeamGroup[]);

      // Sort huddles within each group: official first, then private
      grouped.forEach(group => {
        group.huddles.sort((a, b) => {
          if (a.is_official_team_huddle && !b.is_official_team_huddle) return -1;
          if (!a.is_official_team_huddle && b.is_official_team_huddle) return 1;
          return 0;
        });
      });

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

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading huddles...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Sticky header with title + create button */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-border/50">
        <div className="px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">My Huddles</h1>
            <p className="text-sm text-muted-foreground">Your team chats — public and private</p>
          </div>
          <div className="flex items-center gap-2">
            {user && userRole === 'admin' && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => navigate('/admin')}
                className="rounded-full h-8 w-8 p-0"
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}
            {user ? (
              <Button size="sm" onClick={() => navigate('/teams')} className="gap-1">
                <Plus className="h-4 w-4" />
                New Huddle
              </Button>
            ) : (
              <Button size="sm" onClick={() => navigate('/auth')}>
                Sign In
              </Button>
            )}
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
            <p className="text-muted-foreground mb-4">
              {user 
                ? "Follow your favorite teams from the Team Directory to automatically join their official communities"
                : "Sign in to join official team huddles and start chatting with fellow fans"
              }
            </p>
            <Button onClick={() => navigate(user ? '/teams' : '/auth')}>
              {user ? 'Browse Teams' : 'Sign In'}
            </Button>
          </div>
        ) : (
          <div className="space-y-0">
            {teamGroups.map((group) => {
              // Separate public vs private huddles
              const publicHuddle = group.huddles.find(h => h.is_official_team_huddle);
              const privateHuddles = group.huddles.filter(h => !h.is_official_team_huddle);
              
              return (
                <Collapsible key={group.team_name} defaultOpen className="border-b border-border/30">
                  <CollapsibleTrigger className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted/5 transition-colors">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={group.team_logo_url} alt={group.team_name} />
                      <AvatarFallback className="bg-muted text-xs">
                        {group.team_name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-semibold text-foreground flex-1 text-left">
                      {group.team_name}
                    </span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform" />
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent className="pb-3">
                    {/* PUBLIC HUDDLE BLOCK */}
                    {publicHuddle && (
                      <div className="px-4 py-2">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 ml-1">
                          Public Team Huddle
                        </p>
                        <div 
                          onClick={() => handleHuddlePress(publicHuddle)}
                          className="bg-primary/5 border border-primary/20 rounded-xl p-4 cursor-pointer hover:bg-primary/10 transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center">
                              <Globe className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-foreground">{publicHuddle.name}</p>
                              <p className="text-xs text-muted-foreground">AI-curated team updates + public chat</p>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Users className="h-3 w-3" />
                              {publicHuddle.participant_count}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* PRIVATE HUDDLES BLOCK */}
                    {privateHuddles.length > 0 && (
                      <div className="px-4 py-2">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 ml-1">
                          Your Private Huddles
                        </p>
                        <div className="space-y-2">
                          {privateHuddles.map(huddle => (
                            <div 
                              key={huddle.id}
                              onClick={() => handleHuddlePress(huddle)}
                              className="bg-muted/5 border border-border/40 rounded-xl p-4 cursor-pointer hover:bg-muted/10 transition-all"
                            >
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-muted/20 flex items-center justify-center">
                                  <Lock className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-foreground">{huddle.name}</p>
                                    {huddle.unread_count > 0 && (
                                      <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                                        {huddle.unread_count > 99 ? '99+' : huddle.unread_count}
                                      </Badge>
                                    )}
                                  </div>
                                  {huddle.latest_message && (
                                    <p className="text-xs text-muted-foreground truncate">
                                      {huddle.latest_message.is_bot_message && (
                                        <span className="text-accent">@coach: </span>
                                      )}
                                      {huddle.latest_message.content}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Users className="h-3 w-3" />
                                  {huddle.participant_count}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
