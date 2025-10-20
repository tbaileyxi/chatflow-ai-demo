import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Star, TrendingUp, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { XPostEmbed } from '@/components/embeds/XPostEmbed';
import { isXEmbed } from '@/utils/embedUtils';

interface Highlight {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  heat_count: number;
  author_name: string;
  media_url?: string;
  embed_code?: string;
  message_type?: string;
  embeds?: Array<{
    commentary: string;
    embed_code: string;
    embed_type: 'x' | 'iframe' | 'youtube';
  }>;
}

interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  heat_count: number;
  rank: number;
}

interface RetroHighlightsSidebarProps {
  huddleId: string;
  onClose: () => void;
  onJumpToMessage?: (messageId: string) => void;
  className?: string;
}

export const RetroHighlightsSidebar: React.FC<RetroHighlightsSidebarProps> = ({
  huddleId,
  onClose,
  onJumpToMessage,
  className
}) => {
  const [activeTab, setActiveTab] = useState<'highlights' | 'leaderboard'>('highlights');
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [expandedHighlight, setExpandedHighlight] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHighlights();
    fetchLeaderboard();
    
    // Real-time subscriptions
    const heatChannel = supabase
      .channel(`huddle-heat-${huddleId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_heat_reactions'
        },
        () => {
          fetchHighlights();
          fetchLeaderboard();
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(heatChannel);
    };
  }, [huddleId]);

  const fetchHighlights = async () => {
    try {
      const { data, error } = await supabase
        .from('huddle_messages')
        .select('id, content, user_id, created_at, media_url, embed_code, embeds, message_type')
        .eq('huddle_id', huddleId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Get user profiles
      const userIds = [...new Set(data?.map(m => m.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, username')
        .in('user_id', userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      // Get heat counts for each message
      const messagesWithHeat = await Promise.all(
        (data || []).map(async (msg) => {
          const { count } = await supabase
            .from('message_heat_reactions')
            .select('*', { count: 'exact', head: true })
            .eq('message_id', msg.id);

          const profile = profileMap.get(msg.user_id);
          return {
            id: msg.id,
            content: msg.content,
            user_id: msg.user_id,
            created_at: msg.created_at,
            media_url: msg.media_url,
            embed_code: msg.embed_code,
            embeds: msg.embeds as any,
            message_type: (msg as any).message_type,
            heat_count: count || 0,
            author_name: profile?.display_name || profile?.username || 'Anonymous'
          };
        })
      );

      // Filter: Include messages with 3+ heat OR special message types (highlight_feed, embed, highlight)
      const topHighlights = messagesWithHeat
        .filter(msg => 
          msg.heat_count >= 3 || 
          msg.message_type === 'highlight_feed' || 
          msg.message_type === 'embed' ||
          msg.message_type === 'highlight'
        )
        .sort((a, b) => {
          // Priority: highlight_feed/embed messages first, then by heat count
          const aIsSpecial = a.message_type === 'highlight_feed' || a.message_type === 'embed';
          const bIsSpecial = b.message_type === 'highlight_feed' || b.message_type === 'embed';
          
          if (aIsSpecial && !bIsSpecial) return -1;
          if (!aIsSpecial && bIsSpecial) return 1;
          return b.heat_count - a.heat_count;
        })
        .slice(0, 10);

      setHighlights(topHighlights);
    } catch (error) {
      console.error('Failed to fetch highlights:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      // Get all messages in the huddle (excluding bots and agents)
      const { data: messages } = await supabase
        .from('huddle_messages')
        .select('id, user_id')
        .eq('huddle_id', huddleId)
        .eq('is_bot_message', false)
        .eq('is_team_agent_message', false);

      if (!messages) return;

      // Get heat counts per user
      const userHeatMap = new Map<string, number>();
      
      await Promise.all(
        messages.map(async (msg) => {
          const { count } = await supabase
            .from('message_heat_reactions')
            .select('*', { count: 'exact', head: true })
            .eq('message_id', msg.id);

          const currentCount = userHeatMap.get(msg.user_id) || 0;
          userHeatMap.set(msg.user_id, currentCount + (count || 0));
        })
      );

      // Get user profiles
      const userIds = Array.from(userHeatMap.keys());
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, username')
        .in('user_id', userIds);

      // Create leaderboard
      const leaderboardData = Array.from(userHeatMap.entries())
        .map(([userId, heatCount]) => {
          const profile = profiles?.find(p => p.user_id === userId);
          return {
            user_id: userId,
            display_name: profile?.display_name || profile?.username || 'Anonymous',
            heat_count: heatCount
          };
        })
        .sort((a, b) => b.heat_count - a.heat_count)
        .map((entry, index) => ({
          ...entry,
          rank: index + 1
        }))
        .slice(0, 10);

      setLeaderboard(leaderboardData);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    }
  };

  return (
    <div className={cn(
      "flex flex-col h-full bg-background/95 backdrop-blur-sm",
      className
    )}>
      <div className="flex flex-col h-full p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="retro-header text-lg">Bot's Blitz Board</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 hover:bg-muted/50"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            <Button
              variant={activeTab === 'highlights' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('highlights')}
              className="flex-1 font-arcade text-xs"
            >
              <Star className="w-3 h-3 mr-1" />
              Highlights
            </Button>
            <Button
              variant={activeTab === 'leaderboard' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('leaderboard')}
              className="flex-1 font-arcade text-xs"
            >
              <TrendingUp className="w-3 h-3 mr-1" />
              Heat
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'highlights' ? (
              <div className="space-y-3">
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Loading highlights...
                  </div>
                ) : highlights.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No highlights yet. Messages with 3+ ⚡ or broadcast embeds appear here!
                  </div>
                ) : (
                  highlights.map((highlight) => (
                    <div
                      key={highlight.id}
                      className="retro-embed p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setExpandedHighlight(
                        expandedHighlight === highlight.id ? null : highlight.id
                      )}
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-chat font-medium text-sm">
                              {highlight.author_name}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(highlight.created_at), 'MMM d, h:mm a')}
                            </p>
                          </div>
                          <Badge variant="secondary" className="text-xs flex items-center gap-1">
                            <Zap className="w-3 h-3 fill-current text-yellow-500" />
                            {highlight.heat_count}
                          </Badge>
                        </div>
                        
                        <p className={cn(
                          "text-sm text-foreground/90",
                          expandedHighlight !== highlight.id && "line-clamp-2"
                        )}>
                          {highlight.content}
                        </p>
                        
                        {expandedHighlight === highlight.id && (
                          <div className="pt-2 border-t border-border space-y-2">
                            {highlight.media_url && (
                              <img 
                                src={highlight.media_url} 
                                alt="Message media"
                                className="w-full rounded-lg"
                              />
                            )}
                            
                            {/* New embeds array format */}
                            {highlight.embeds && highlight.embeds.length > 0 && (
                              <div className="space-y-2">
                                {highlight.embeds.map((embed, idx) => (
                                  <div key={idx}>
                                    {embed.embed_type === 'x' && embed.embed_code && (
                                      <XPostEmbed embedCode={embed.embed_code} />
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {/* Legacy embed_code format */}
                            {!highlight.embeds && highlight.embed_code && isXEmbed(highlight.embed_code) && (
                              <XPostEmbed embedCode={highlight.embed_code} />
                            )}
                            
                            {onJumpToMessage && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onJumpToMessage(highlight.id);
                                  onClose();
                                }}
                                className="w-full text-xs"
                              >
                                Jump to Message
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <h3 className="font-arcade text-sm text-center neon-text">Huddle Heat</h3>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Loading leaderboard...
                  </div>
                ) : leaderboard.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No heat yet. Give ⚡ to messages you like!
                  </div>
                ) : (
                  leaderboard.map((player) => (
                    <div
                      key={player.user_id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                    >
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-xs font-pixel",
                          player.rank === 1 && "bg-yellow-500/20 text-yellow-500",
                          player.rank === 2 && "bg-slate-400/20 text-slate-400",
                          player.rank === 3 && "bg-orange-500/20 text-orange-500",
                          player.rank > 3 && "bg-team-primary/20"
                        )}>
                          {player.rank}
                        </span>
                        <span className="font-chat text-sm">{player.display_name}</span>
                      </div>
                      <Badge variant="outline" className="text-xs flex items-center gap-1">
                        <Zap className="w-3 h-3 fill-current text-yellow-500" />
                        {player.heat_count}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
      </div>
    </div>
  );
};