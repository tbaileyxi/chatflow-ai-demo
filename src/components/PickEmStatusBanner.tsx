import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, Clock, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PickEmStatusBannerProps {
  huddleId: string;
  userId: string;
  onViewDetails: (instanceId: string) => void;
}

interface ActiveInstance {
  id: string;
  title: string;
  status: string;
  game_count: number;
  user_picks: number;
  deadline_approaching: boolean;
  has_future_games?: boolean;
}

export const PickEmStatusBanner = ({ huddleId, userId, onViewDetails }: PickEmStatusBannerProps) => {
  const [activeInstance, setActiveInstance] = useState<ActiveInstance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveInstance();
  }, [huddleId, userId]);

  const fetchActiveInstance = async () => {
    try {
      // Get active Pick 'Em instance for this huddle
      const { data: instances } = await supabase
        .from('pickem_instances')
        .select(`
          id,
          title,
          status,
          pickem_instance_games!inner(
            pickem_games!inner(
              id,
              start_time,
              status
            )
          )
        `)
        .eq('huddle_id', huddleId)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1);

      if (!instances || instances.length === 0) {
        setActiveInstance(null);
        setLoading(false);
        return;
      }

      const instance = instances[0];
      const games = instance.pickem_instance_games.map(ig => ig.pickem_games);
      
      // Check user's picks for this instance
      const { data: userEntry } = await supabase
        .from('pickem_entries')
        .select(`
          id,
          pickem_picks(count)
        `)
        .eq('instance_id', instance.id)
        .eq('user_id', userId)
        .single();

      const userPicksCount = userEntry?.pickem_picks?.[0]?.count || 0;
      
      // Check if deadline is approaching (within 24 hours) and in the future
      const now = new Date();
      const futureGames = games.filter(g => g.status === 'scheduled' && new Date(g.start_time) > now);
      const nextDeadline = futureGames
        .map(g => new Date(g.start_time))
        .sort((a, b) => a.getTime() - b.getTime())[0];
      
      const deadlineApproaching = nextDeadline && 
        (nextDeadline.getTime() - now.getTime()) < 24 * 60 * 60 * 1000;

      setActiveInstance({
        id: instance.id,
        title: instance.title,
        status: instance.status,
        game_count: games.length,
        user_picks: userPicksCount,
        deadline_approaching: !!deadlineApproaching,
        has_future_games: futureGames.length > 0
      });
    } catch (error) {
      console.error('Error fetching active Pick\'em instance:', error);
      setActiveInstance(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !activeInstance) {
    return null;
  }

  const isIncomplete = activeInstance.user_picks < activeInstance.game_count;
  const hasFutureGames = activeInstance.has_future_games !== false;
  const showBanner = (isIncomplete || activeInstance.deadline_approaching) && hasFutureGames;

  if (!showBanner) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20 m-4 mb-0">
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/20 p-2 rounded-lg">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">{activeInstance.title}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={isIncomplete ? "destructive" : "secondary"} className="text-xs">
                  {isIncomplete ? (
                    <Target className="h-3 w-3 mr-1" />
                  ) : (
                    <Clock className="h-3 w-3 mr-1" />
                  )}
                  {isIncomplete 
                    ? `${activeInstance.user_picks}/${activeInstance.game_count} picks made`
                    : `All picks complete`
                  }
                </Badge>
                {activeInstance.deadline_approaching && (
                  <Badge variant="outline" className="text-xs border-orange-500 text-orange-600">
                    <Clock className="h-3 w-3 mr-1" />
                    Deadline approaching
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <Button 
            size="sm"
            onClick={() => onViewDetails(activeInstance.id)}
            className="bg-primary/20 hover:bg-primary/30 text-primary border-primary/20"
          >
            {isIncomplete ? 'Complete Picks' : 'View'}
          </Button>
        </div>
      </div>
    </Card>
  );
};