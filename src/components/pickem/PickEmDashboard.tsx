import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Calendar, Users, Zap, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface PickEmDashboardProps {
  huddleId: string;
  onBack: () => void;
}

interface WeekInstance {
  id: string;
  title: string;
  status: string;
  week_number: number;
  season_year: number;
  league: string;
  entries_count: number;
  games_count: number;
  user_entry?: {
    id: string;
    total_score: number;
    rank?: number;
  };
}

interface SeasonStats {
  user_id: string;
  display_name: string;
  username: string;
  entries_played: number;
  total_correct_picks: number;
  win_percentage: number;
  rank: number;
}

export const PickEmDashboard = ({ huddleId, onBack }: PickEmDashboardProps) => {
  const [weekInstances, setWeekInstances] = useState<WeekInstance[]>([]);
  const [seasonStats, setSeasonStats] = useState<SeasonStats[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchPickEmData();
  }, [huddleId]);

  const fetchPickEmData = async () => {
    try {
      // Get all Pick 'Em instances for this huddle with their week info
      const { data: instancesData, error: instancesError } = await supabase
        .from('pickem_instances')
        .select(`
          id,
          title,
          status,
          pickem_weeks!inner(
            id,
            league,
            season_year,
            week_number
          )
        `)
        .eq('huddle_id', huddleId)
        .order('created_at', { ascending: false });

      if (instancesError) throw instancesError;

      // For each instance, get entry count, game count, and user's entry if exists
      const enrichedInstances = await Promise.all(
        (instancesData || []).map(async (instance) => {
          // Get entry count
          const { count: entryCount } = await supabase
            .from('pickem_entries')
            .select('*', { count: 'exact', head: true })
            .eq('instance_id', instance.id);

          // Get game count
          const { count: gameCount } = await supabase
            .from('pickem_instance_games')
            .select('*', { count: 'exact', head: true })
            .eq('instance_id', instance.id);

          // Get user's entry and rank
          let userEntry = null;
          if (user?.id) {
            const { data: entryData } = await supabase
              .from('pickem_entries')
              .select('id, total_score')
              .eq('instance_id', instance.id)
              .eq('user_id', user.id)
              .single();

            if (entryData) {
              // Get user's rank from leaderboard function
              const { data: leaderboardData } = await supabase.rpc('get_pickem_leaderboard', {
                target_instance_id: instance.id
              });

              const userRank = leaderboardData?.find((entry: any) => entry.user_id === user.id)?.rank || null;

              userEntry = {
                ...entryData,
                rank: userRank
              };
            }
          }

          return {
            id: instance.id,
            title: instance.title,
            status: instance.status,
            week_number: instance.pickem_weeks.week_number,
            season_year: instance.pickem_weeks.season_year,
            league: instance.pickem_weeks.league,
            entries_count: entryCount || 0,
            games_count: gameCount || 0,
            user_entry: userEntry
          };
        })
      );

      setWeekInstances(enrichedInstances);

      // Get season-long stats using new function
      const { data: seasonData, error: seasonError } = await supabase.rpc('get_pickem_season_leaderboard', {
        target_league: 'nfl',
        target_season: 2024
      });

      if (seasonError) throw seasonError;
      setSeasonStats(seasonData || []);

    } catch (error) {
      console.error('Error fetching pick em data:', error);
      toast({
        title: "Error",
        description: "Failed to load Pick 'Em data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleJoinPickEm = async (instanceId: string) => {
    try {
      const { error } = await supabase
        .from('pickem_entries')
        .insert({
          instance_id: instanceId,
          user_id: user?.id,
          total_score: 0
        });

      if (error) throw error;

      toast({
        title: "Joined!",
        description: "You've joined this Pick 'Em. Make your selections now!",
      });

      await fetchPickEmData();
    } catch (error) {
      console.error('Error joining pick em:', error);
      toast({
        title: "Error",
        description: "Failed to join Pick 'Em",
        variant: "destructive"
      });
    }
  };

  const triggerWeek2Scoring = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('pickem-scoring');
      if (error) throw error;

      toast({
        title: "Scoring Triggered",
        description: "Week 2 scores are being updated",
      });

      await fetchPickEmData();
    } catch (error) {
      console.error('Error triggering scoring:', error);
      toast({
        title: "Error", 
        description: "Failed to trigger scoring",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-2">
          <div className="h-6 bg-muted rounded w-1/3"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            Pick 'Em Central
          </h2>
          <p className="text-sm text-muted-foreground">
            All weeks, leaderboards, and season stats
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={triggerWeek2Scoring}>
            <Zap className="w-4 h-4 mr-1" />
            Update Scores
          </Button>
          <Button variant="outline" onClick={onBack}>
            Back to Chat
          </Button>
        </div>
      </div>

      <Tabs defaultValue="weeks" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="weeks">All Weeks</TabsTrigger>
          <TabsTrigger value="season">Season Stats</TabsTrigger>
          <TabsTrigger value="current">Current Week</TabsTrigger>
        </TabsList>
        
        <TabsContent value="weeks" className="space-y-4">
          <div className="grid gap-3">
            {weekInstances.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground">No Pick 'Em instances found for this huddle.</p>
                </CardContent>
              </Card>
            ) : (
              weekInstances.map((instance) => (
                <Card key={instance.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="font-medium">{instance.league.toUpperCase()} {instance.season_year} - Week {instance.week_number}</h3>
                        <p className="text-sm text-muted-foreground">{instance.title}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={instance.status === 'open' ? 'default' : 'secondary'}>
                          {instance.status}
                        </Badge>
                        {instance.user_entry && (
                          <Badge variant="outline">
                            Rank #{instance.user_entry.rank || 'N/A'}
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {instance.entries_count} entries
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {instance.games_count} games
                      </div>
                      {instance.user_entry && (
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          {instance.user_entry.total_score} correct
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {!instance.user_entry ? (
                        <Button 
                          size="sm" 
                          onClick={() => handleJoinPickEm(instance.id)}
                          disabled={instance.status === 'closed'}
                        >
                          Join Pick 'Em
                        </Button>
                      ) : (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => window.location.href = `/huddle/${huddleId}/pickem/${instance.id}`}
                        >
                          View Details
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="season" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5" />
                Season Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              {seasonStats.length === 0 ? (
                <p className="text-center text-muted-foreground">No season stats available yet</p>
              ) : (
                 <div className="space-y-3">
                   {seasonStats.map((stat, index) => (
                     <div
                       key={stat.user_id || index}
                       className={`flex items-center justify-between p-3 rounded-lg ${
                         stat.user_id === user?.id ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50'
                       }`}
                     >
                       <div className="flex items-center gap-3">
                         <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                           stat.rank === 1 ? 'bg-yellow-500 text-white' :
                           stat.rank === 2 ? 'bg-gray-400 text-white' :
                           stat.rank === 3 ? 'bg-amber-600 text-white' :
                           'bg-muted text-muted-foreground'
                         }`}>
                           {stat.rank || index + 1}
                         </div>
                         <div>
                           <div className="font-medium">
                             {stat.display_name && stat.display_name !== 'User' && stat.display_name.trim() 
                               ? stat.display_name 
                               : stat.username && stat.username.trim() 
                                 ? stat.username 
                                 : `User ${(stat.user_id || '').slice(0, 8)}`}
                             {stat.user_id === user?.id && (
                               <span className="text-xs text-muted-foreground ml-2">(You)</span>
                             )}
                           </div>
                           <div className="text-xs text-muted-foreground">
                             {stat.entries_played || 0} weeks • {Math.round((stat.win_percentage || 0) * 100)}% accuracy
                           </div>
                         </div>
                       </div>
                       <Badge variant="secondary">
                         {stat.total_correct_picks || 0} total correct
                       </Badge>
                     </div>
                   ))}
                 </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="current" className="space-y-4">
          {(() => {
            const currentWeek = weekInstances.find(w => w.status === 'open') || weekInstances[0];
            
            if (!currentWeek) {
              return (
                <Card>
                  <CardContent className="p-6 text-center">
                    <p className="text-muted-foreground">No active Pick 'Em week found.</p>
                  </CardContent>
                </Card>
              );
            }

            return (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    {currentWeek.league.toUpperCase()} {currentWeek.season_year} - Week {currentWeek.week_number}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <span>{currentWeek.entries_count} participants</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>{currentWeek.games_count} games</span>
                      </div>
                      <Badge variant={currentWeek.status === 'open' ? 'default' : 'secondary'}>
                        {currentWeek.status}
                      </Badge>
                    </div>
                    
                    {currentWeek.user_entry ? (
                      <div className="bg-primary/10 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">Your Performance</p>
                            <p className="text-sm text-muted-foreground">
                              {currentWeek.user_entry.total_score} correct picks
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold">#{currentWeek.user_entry.rank || 'N/A'}</div>
                            <div className="text-xs text-muted-foreground">Current rank</div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-muted-foreground mb-3">You haven't joined this week yet</p>
                        <Button onClick={() => handleJoinPickEm(currentWeek.id)}>
                          Join Week {currentWeek.week_number}
                        </Button>
                      </div>
                    )}
                    
                    <Button 
                      className="w-full" 
                      variant="outline"
                      onClick={() => window.location.href = `/huddle/${huddleId}/pickem/${currentWeek.id}`}
                    >
                      {currentWeek.user_entry ? 'Manage Picks' : 'View Details'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })()}
        </TabsContent>
      </Tabs>
    </div>
  );
};