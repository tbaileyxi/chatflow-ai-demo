import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Plus, Users, Globe, Lock, ShieldCheck } from 'lucide-react';
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

export const HuddleList = () => {
  const [publicHuddles, setPublicHuddles] = useState<Huddle[]>([]);
  const [privateHuddles, setPrivateHuddles] = useState<Huddle[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const fetchHuddles = async () => {
    try {
      if (!user) {
        setPublicHuddles([]);
        setPrivateHuddles([]);
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

      // Get unread counts for user
      let unreadCounts: Record<string, number> = {};
      
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

      // Split into public and private huddles
      const publicOnes = transformedHuddles.filter(h => h.is_official_team_huddle);
      const privateOnes = transformedHuddles.filter(h => !h.is_official_team_huddle);

      setPublicHuddles(publicOnes);
      setPrivateHuddles(privateOnes);
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

  const hasNoHuddles = publicHuddles.length === 0 && privateHuddles.length === 0;

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Sticky header with title + create button */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-border/50">
        <div className="px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">My Huddles</h1>
          </div>
          {user ? (
            <Button 
              size="sm" 
              onClick={() => navigate('/')} 
              className="gap-1 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
            >
              <Plus className="h-4 w-4" />
              New Side Huddle
            </Button>
          ) : (
            <Button 
              size="sm" 
              onClick={() => navigate('/auth?signup=true')}
              className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
            >
              Join the Huddle
            </Button>
          )}
        </div>
      </div>

      {/* Huddle list */}
      <div className="flex-1 overflow-y-auto pb-28">
        {hasNoHuddles ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">No huddles yet</h3>
            <p className="text-muted-foreground mb-4">
              {user 
                ? "Follow your favorite teams from the Team Directory to automatically join their public communities"
                : "Join to connect with fellow fans in team huddles"
              }
            </p>
            <Button 
              onClick={() => navigate(user ? '/' : '/auth?signup=true')}
              className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
            >
              {user ? 'Browse Teams' : 'Join the Huddle'}
            </Button>
          </div>
        ) : (
          <div className="space-y-6 p-4">
            {/* Public huddles you follow */}
            {publicHuddles.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Public huddles you follow
                </h2>
                <div className="space-y-2">
                  {publicHuddles.map(huddle => (
                    <div 
                      key={huddle.id}
                      onClick={() => handleHuddlePress(huddle)}
                      className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20 cursor-pointer hover:bg-primary/10 transition-all"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={huddle.team_logo_url} alt={huddle.team_name} />
                        <AvatarFallback className="bg-primary/20 text-xs">
                          {huddle.team_name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-primary" />
                          <span className="font-medium text-foreground truncate">{huddle.team_name}</span>
                          {huddle.unread_count > 0 && (
                            <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                              {huddle.unread_count > 99 ? '99+' : huddle.unread_count}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Private side huddles */}
            {privateHuddles.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Private side huddles
                </h2>
                <div className="space-y-2">
                  {privateHuddles.map(huddle => (
                    <div 
                      key={huddle.id}
                      onClick={() => handleHuddlePress(huddle)}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                        huddle.is_verified 
                          ? 'bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20' 
                          : 'bg-muted/5 border border-border/40 hover:bg-muted/10'
                      }`}
                    >
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        huddle.is_verified ? 'bg-emerald-500/20' : 'bg-muted/20'
                      }`}>
                        {huddle.is_verified ? (
                          <ShieldCheck className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Lock className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground truncate">{huddle.name}</span>
                          {huddle.is_verified && (
                            <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-emerald-500/50 text-emerald-500">
                              VERIFIED
                            </Badge>
                          )}
                          {huddle.unread_count > 0 && (
                            <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                              {huddle.unread_count > 99 ? '99+' : huddle.unread_count}
                            </Badge>
                          )}
                        </div>
                        {huddle.latest_message && (
                          <p className="text-xs text-muted-foreground truncate">
                            {huddle.latest_message.content}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        ({huddle.participant_count})
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
