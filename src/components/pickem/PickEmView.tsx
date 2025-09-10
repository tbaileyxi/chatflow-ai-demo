import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Clock, CheckCircle2, XCircle, Users, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface PickEmViewProps {
  instanceId: string;
  onBack: () => void;
}

interface Game {
  id: string;
  espn_game_id: string;
  home_team: string;
  away_team: string;
  start_time: string;
  status: string;
  winning_team?: string;
}

interface Pick {
  id: string;
  game_id: string;
  picked_team: string;
  is_correct?: boolean;
}

interface Entry {
  id?: string;
  user_id: string;
  total_score: number;
  display_name?: string;
  username?: string;
  rank?: number;
}

export const PickEmView = ({ instanceId, onBack }: PickEmViewProps) => {
  const [instance, setInstance] = useState<any>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [userPicks, setUserPicks] = useState<Pick[]>([]);
  const [leaderboard, setLeaderboard] = useState<Entry[]>([]);
  const [userEntry, setUserEntry] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (instanceId) {
      fetchPickEmData();
      
      // Subscribe to realtime changes on entries for this instance
      const channel = supabase
        .channel('pickem-entries-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'pickem_entries',
            filter: `instance_id=eq.${instanceId}`
          },
          () => {
            // Refetch leaderboard when any entry changes
            fetchPickEmData();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [instanceId]);

  const fetchPickEmData = async () => {
    try {
      // Get instance details
      const { data: instanceData, error: instanceError } = await supabase
        .from('pickem_instances')
        .select(`
          *,
          pickem_weeks(league, season_year, week_number)
        `)
        .eq('id', instanceId)
        .single();

      if (instanceError) throw instanceError;
      setInstance(instanceData);

      // Get games for this instance
      const { data: gamesData, error: gamesError } = await supabase
        .from('pickem_instance_games')
        .select(`
          pickem_games(*)
        `)
        .eq('instance_id', instanceId);

      if (gamesError) throw gamesError;
      const gamesList = gamesData?.map(g => g.pickem_games).sort((a: any, b: any) => 
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      ) || [];
      setGames(gamesList);

      // Get user's entry and picks
      const { data: entryData, error: entryError } = await supabase
        .from('pickem_entries')
        .select('*')
        .eq('instance_id', instanceId)
        .eq('user_id', user?.id)
        .maybeSingle();

      if (entryError) throw entryError;
      setUserEntry(entryData);

      if (entryData) {
        const { data: picksData, error: picksError } = await supabase
          .from('pickem_picks')
          .select('*')
          .eq('entry_id', entryData.id);

        if (picksError) throw picksError;
        setUserPicks(picksData || []);
      }

      // Get leaderboard
      const { data: leaderboardData, error: leaderboardError } = await supabase
        .from('pickem_leaderboard')
        .select('*')
        .eq('instance_id', instanceId)
        .order('rank', { ascending: true })
        .limit(10);

      if (leaderboardError) throw leaderboardError;
      setLeaderboard(leaderboardData || []);

    } catch (error) {
      console.error('Error fetching pick em data:', error);
      toast({
        title: "Error",
        description: "Failed to load Pick 'Em details",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMakePick = async (gameId: string, team: string) => {
    if (!userEntry) return;

    try {
      const { error } = await supabase
        .from('pickem_picks')
        .upsert({
          entry_id: userEntry.id,
          game_id: gameId,
          picked_team: team
        }, {
          onConflict: 'entry_id,game_id'
        });

      if (error) throw error;

      // Update local state
      setUserPicks(prev => {
        const existing = prev.find(p => p.game_id === gameId);
        if (existing) {
          return prev.map(p => p.game_id === gameId ? { ...p, picked_team: team } : p);
        } else {
          return [...prev, { id: '', game_id: gameId, picked_team: team }];
        }
      });

      toast({
        title: "Pick Updated",
        description: `You picked ${team}`,
      });

    } catch (error) {
      console.error('Error making pick:', error);
      toast({
        title: "Error",
        description: "Failed to save pick",
        variant: "destructive"
      });
    }
  };

  const isGameLocked = (game: Game) => {
    return new Date(game.start_time) <= new Date() || game.status !== 'scheduled';
  };

  const refreshData = async () => {
    setLoading(true);
    await fetchPickEmData();
  };

  const getPickForGame = (gameId: string) => {
    return userPicks.find(p => p.game_id === gameId);
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
            {instance?.title}
          </h2>
          <p className="text-sm text-muted-foreground">
            {instance?.pickem_weeks?.league?.toUpperCase()} {instance?.pickem_weeks?.season_year} - Week {instance?.pickem_weeks?.week_number}
          </p>
        </div>
        <Button variant="outline" onClick={onBack}>
          Back to Chat
        </Button>
      </div>

      <Tabs defaultValue="picks" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="picks">Your Picks</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
        </TabsList>
        
        <TabsContent value="picks" className="space-y-4">
          {!userEntry ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground mb-4">You haven't joined this Pick 'Em yet.</p>
                <Button onClick={() => window.location.reload()}>
                  Refresh to Join
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {games.map((game) => {
                const pick = getPickForGame(game.id);
                const locked = isGameLocked(game);
                const gameComplete = game.status === 'final';
                
                return (
                  <Card key={game.id} className="w-full overflow-hidden">
                    <CardContent className="p-3 min-w-0">
                      <div className="flex items-center justify-between mb-3 min-w-0">
                        <div className="text-xs font-medium truncate pr-2 min-w-0 flex-1">
                          <span className="truncate">{game.away_team}</span> @ <span className="truncate">{game.home_team}</span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {gameComplete && pick && (
                            <div className="flex items-center gap-1">
                              {pick.is_correct ? (
                                <CheckCircle2 className="w-3 h-3 text-green-500" />
                              ) : (
                                <XCircle className="w-3 h-3 text-red-500" />
                              )}
                            </div>
                          )}
                          <Badge variant={locked ? "secondary" : "outline"} className="text-xs">
                            {locked ? (game.status === 'final' ? 'Final' : 'Locked') : 'Open'}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="text-xs text-muted-foreground mb-3">
                        {new Date(game.start_time).toLocaleDateString()} at {new Date(game.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        {gameComplete && game.winning_team && (
                          <span className="ml-2 font-medium">Winner: {game.winning_team}</span>
                        )}
                      </div>

                      {locked ? (
                        <div className="text-sm">
                          {pick ? (
                            <div className="flex items-center gap-2">
                              <span>Your pick:</span>
                              <Badge variant={pick.is_correct ? "default" : pick.is_correct === false ? "destructive" : "secondary"}>
                                {pick.picked_team}
                              </Badge>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">No pick made</span>
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            size="sm"
                            variant={pick?.picked_team === game.away_team ? "default" : "outline"}
                            onClick={() => handleMakePick(game.id, game.away_team)}
                            className="min-w-0 text-xs truncate"
                          >
                            <span className="truncate">{game.away_team}</span>
                          </Button>
                          <Button
                            size="sm"
                            variant={pick?.picked_team === game.home_team ? "default" : "outline"}
                            onClick={() => handleMakePick(game.id, game.home_team)}
                            className="min-w-0 text-xs truncate"
                          >
                            <span className="truncate">{game.home_team}</span>
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              
              {userEntry && games.some(game => !isGameLocked(game)) && (
                <div className="pt-4 border-t">
                  <Button 
                    onClick={() => {
                      toast({
                        title: "Picks Submitted!",
                        description: "Your selections have been saved.",
                      });
                      onBack();
                    }}
                    className="w-full"
                    size="lg"
                  >
                    Submit Picks
                  </Button>
                </div>
              )}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="leaderboard" className="space-y-4">
          <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Leaderboard
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={refreshData} disabled={loading}>
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
            </CardHeader>
            <CardContent>
              {leaderboard.length === 0 ? (
                <p className="text-center text-muted-foreground">No entries yet</p>
              ) : (
                <div className="space-y-2">
                  {leaderboard.map((entry) => (
                    <div
                      key={entry.user_id}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        entry.user_id === user?.id ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          (entry.rank || 0) === 1 ? 'bg-yellow-500 text-white' :
                          (entry.rank || 0) === 2 ? 'bg-gray-400 text-white' :
                          (entry.rank || 0) === 3 ? 'bg-amber-600 text-white' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {entry.rank}
                        </div>
                        <div>
                          <div className="font-medium">
                            {entry.display_name && entry.display_name !== 'User' ? entry.display_name : entry.username}
                            {entry.user_id === user?.id && (
                              <span className="text-xs text-muted-foreground ml-2">(You)</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Badge variant="secondary">
                        {entry.total_score} correct
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};