import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Users, RefreshCw, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface PickEmLeaderboardCardProps {
  instanceId: string;
  title?: string;
  onViewDetails?: (instanceId: string) => void;
}

interface LeaderboardEntry {
  user_id: string;
  display_name: string | null;
  username: string | null;
  total_score: number;
  rank: number;
}

export const PickEmLeaderboardCard: React.FC<PickEmLeaderboardCardProps> = ({
  instanceId,
  title = "Pick 'Em Results",
  onViewDetails
}) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [instanceInfo, setInstanceInfo] = useState<any>(null);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      
      // Get instance info
      const { data: instanceData, error: instanceError } = await supabase
        .from('pickem_instances')
        .select('*')
        .eq('id', instanceId)
        .single();
      
      if (instanceError) throw instanceError;
      setInstanceInfo(instanceData);

      // Get leaderboard
      const { data: leaderboardData, error: leaderboardError } = await supabase
        .from('pickem_leaderboard')
        .select('*')
        .eq('instance_id', instanceId)
        .order('rank', { ascending: true })
        .limit(5);

      if (leaderboardError) throw leaderboardError;
      setLeaderboard(leaderboardData || []);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [instanceId]);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return '📍';
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'text-yellow-600 dark:text-yellow-400';
      case 2:
        return 'text-gray-600 dark:text-gray-400';
      case 3:
        return 'text-orange-600 dark:text-orange-400';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto bg-gradient-to-br from-background/95 to-muted/50 border-border/50 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Trophy className="w-5 h-5 text-yellow-600" />
            {title}
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={fetchLeaderboard} 
            disabled={loading}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
        </div>
        {instanceInfo && (
          <p className="text-sm text-muted-foreground">
            {instanceInfo.title || 'Pick \'Em Challenge'}
          </p>
        )}
      </CardHeader>
      
      <CardContent className="space-y-3">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 animate-pulse">
                <div className="w-6 h-6 bg-muted-foreground/20 rounded"></div>
                <div className="flex-1 h-4 bg-muted-foreground/20 rounded"></div>
                <div className="w-12 h-4 bg-muted-foreground/20 rounded"></div>
              </div>
            ))}
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-6">
            <Users className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No entries yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {leaderboard.map((entry) => (
              <div
                key={entry.user_id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg transition-all duration-200",
                  "bg-muted/50 hover:bg-muted/70",
                  entry.rank <= 3 && "ring-1 ring-primary/20"
                )}
              >
                <div className="flex items-center gap-2 min-w-[2rem]">
                  <span className="text-lg" title={`Rank ${entry.rank}`}>
                    {getRankIcon(entry.rank)}
                  </span>
                  <span className={cn("text-sm font-medium", getRankColor(entry.rank))}>
                    #{entry.rank}
                  </span>
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {entry.display_name || entry.username || `User ${entry.user_id.slice(0, 8)}`}
                  </p>
                </div>
                
                <div className="text-right">
                  <p className="font-bold text-sm text-primary">
                    {entry.total_score} pts
                  </p>
                </div>
              </div>
            ))}
            
            {leaderboard.length >= 5 && onViewDetails && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onViewDetails(instanceId)}
                className="w-full mt-3 text-sm"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View Full Leaderboard
              </Button>
            )}
          </div>
        )}
        
        {!loading && leaderboard.length > 0 && (
          <div className="pt-2 border-t border-border/50">
            <p className="text-xs text-muted-foreground text-center">
              Showing top {Math.min(leaderboard.length, 5)} players
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};