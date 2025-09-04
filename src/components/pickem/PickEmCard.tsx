import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Clock, Users, Target } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

interface PickEmCardProps {
  instanceId: string;
  title: string;
  gameCount: number;
  onViewDetails: (instanceId: string) => void;
}

interface PickEmStats {
  totalEntries: number;
  userEntry?: {
    id: string;
    total_score: number;
    rank: number;
  };
  hasStartedGames: boolean;
  allGamesComplete: boolean;
}

export const PickEmCard = ({ instanceId, title, gameCount, onViewDetails }: PickEmCardProps) => {
  const [stats, setStats] = useState<PickEmStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (instanceId) {
      fetchStats();
    }
  }, [instanceId]);

  const fetchStats = async () => {
    try {
      // Get total entries
      const { data: entries, error: entriesError } = await supabase
        .from('pickem_entries')
        .select('id, user_id, total_score')
        .eq('instance_id', instanceId);

      if (entriesError) throw entriesError;

      // Get user's entry and rank
      const userEntry = entries?.find(e => e.user_id === user?.id);
      let userRank = 0;
      if (userEntry) {
        const betterEntries = entries?.filter(e => e.total_score > userEntry.total_score).length || 0;
        userRank = betterEntries + 1;
      }

      // Check game status
      const { data: games, error: gamesError } = await supabase
        .from('pickem_instance_games')
        .select(`
          pickem_games!inner(
            status,
            start_time
          )
        `)
        .eq('instance_id', instanceId);

      if (gamesError) throw gamesError;

      const gameStatuses = games?.map(g => g.pickem_games) || [];
      const hasStartedGames = gameStatuses.some(g => 
        g.status !== 'scheduled' || new Date(g.start_time) <= new Date()
      );
      const allGamesComplete = gameStatuses.every(g => g.status === 'final');

      setStats({
        totalEntries: entries?.length || 0,
        userEntry: userEntry ? {
          id: userEntry.id,
          total_score: userEntry.total_score,
          rank: userRank
        } : undefined,
        hasStartedGames,
        allGamesComplete
      });

    } catch (error) {
      console.error('Error fetching pick em stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinPickEm = async () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to join Pick 'Em.",
      });
      navigate('/auth');
      return;
    }
    if (stats?.userEntry) return;

    try {
      setJoining(true);
      const { error } = await supabase
        .from('pickem_entries')
        .insert({
          instance_id: instanceId,
          user_id: user.id
        });

      if (error) throw error;

      toast({
        title: "Joined Pick 'Em!",
        description: "You can now make your picks",
      });

      // Refresh stats
      fetchStats();

    } catch (error) {
      console.error('Error joining pick em:', error);
      toast({
        title: "Error",
        description: "Failed to join Pick 'Em",
        variant: "destructive"
      });
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-3 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className="w-full border-primary/20 cursor-pointer"
      role="button"
      tabIndex={0}
      onClick={() => onViewDetails(instanceId)}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="w-4 h-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Target className="w-3 h-3" />
            {gameCount} games
          </div>
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {stats?.totalEntries || 0} entries
          </div>
        </div>

        {stats?.userEntry ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Your Score:</span>
              <Badge variant="secondary">
                {stats.userEntry.total_score} correct
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Your Rank:</span>
              <Badge variant="outline">
                #{stats.userEntry.rank}
              </Badge>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-3 h-3" />
            {stats?.hasStartedGames ? "Picks locked" : "Join to make picks"}
          </div>
        )}

        <div className="flex gap-2">
          <Button 
            size="sm" 
            onClick={(e) => { e.stopPropagation(); onViewDetails(instanceId); }}
            className="flex-1"
          >
            View Details
          </Button>
          
          {!stats?.userEntry && !stats?.hasStartedGames && (
            <Button 
              size="sm" 
              variant="outline"
              disabled={joining}
              onClick={(e) => { e.stopPropagation(); handleJoinPickEm(); }}
            >
              {joining ? 'Joining…' : 'Join'}
            </Button>
          )}
        </div>

        {stats?.allGamesComplete && (
          <Badge variant="default" className="w-full justify-center">
            Complete
          </Badge>
        )}
      </CardContent>
    </Card>
  );
};