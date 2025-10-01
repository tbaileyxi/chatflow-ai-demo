import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Search, Users, Trophy, Heart, Check, Clock, Eye } from 'lucide-react';
import { StartHuddleDialog } from '@/components/StartHuddleDialog';

interface Team {
  id: string;
  name: string;
  city: string;
  league: string;
  conference: string;
  division: string;
  logo_url?: string;
  description?: string;
  follower_count?: number;
  is_following?: boolean;
  status: 'active' | 'coming_soon' | 'inactive';
}

export const TeamDirectory = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [followedTeams, setFollowedTeams] = useState<Team[]>([]);
  const [waitlistTeams, setWaitlistTeams] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLeague, setSelectedLeague] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeams();
    if (user) {
      fetchFollowedTeams();
      fetchWaitlistTeams();
    }
  }, [user]);

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .order('league', { ascending: true })
        .order('city', { ascending: true });

      if (error) throw error;
      setTeams((data || []) as Team[]);
    } catch (error) {
      console.error('Error fetching teams:', error);
      toast({
        title: "Error",
        description: "Failed to load teams",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchFollowedTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('user_follows')
        .select(`
          team:teams(*)
        `)
        .eq('user_id', user?.id);

      if (error) throw error;
      setFollowedTeams((data?.map(item => item.team) || []) as Team[]);
    } catch (error) {
      console.error('Error fetching followed teams:', error);
    }
  };

  const fetchWaitlistTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('team_waitlist')
        .select('team_id')
        .eq('user_id', user?.id);

      if (error) throw error;
      setWaitlistTeams(data?.map(item => item.team_id) || []);
    } catch (error) {
      console.error('Error fetching waitlist teams:', error);
    }
  };

  const toggleFollow = async (teamId: string) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to follow teams",
        variant: "destructive"
      });
      return;
    }

    try {
      const isFollowing = followedTeams.some(team => team.id === teamId);
      
      if (isFollowing) {
        const { error } = await supabase
          .from('user_follows')
          .delete()
          .eq('user_id', user.id)
          .eq('team_id', teamId);

        if (error) throw error;
        
        setFollowedTeams(prev => prev.filter(team => team.id !== teamId));
        toast({
          title: "Success",
          description: "Team unfollowed",
        });
      } else {
        const { error } = await supabase
          .from('user_follows')
          .insert({
            user_id: user.id,
            team_id: teamId
          });

        if (error) throw error;
        
        const team = teams.find(t => t.id === teamId);
        if (team) {
          setFollowedTeams(prev => [...prev, team]);
        }
        
        toast({
          title: "Success",
          description: "Team followed!",
        });
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      toast({
        title: "Error",
        description: "Failed to update follow status",
        variant: "destructive"
      });
    }
  };

  const joinWaitlist = async (teamId: string) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to join waitlist",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('team_waitlist')
        .insert({
          team_id: teamId,
          user_id: user.id,
          email: user.email || user.phone || ''
        });

      if (error) throw error;
      
      setWaitlistTeams(prev => [...prev, teamId]);
      toast({
        title: "Success",
        description: "You'll be notified when this team launches!",
      });
    } catch (error) {
      console.error('Error joining waitlist:', error);
      toast({
        title: "Error",
        description: "Failed to join waitlist",
        variant: "destructive"
      });
    }
  };

  const activeTeams = teams.filter(team => team.status === 'active');
  const comingSoonTeams = teams.filter(team => team.status === 'coming_soon');
  const totalActiveTeams = activeTeams.length;
  const ncaaTeamCount = teams.filter(t => t.league === 'NCAA' && t.status === 'active').length;
  
  const filteredActiveTeams = activeTeams.filter(team => {
    const matchesSearch = team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         team.city.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLeague = selectedLeague === 'all' || team.league === selectedLeague;
    return matchesSearch && matchesLeague;
  });

  const filteredComingSoonTeams = comingSoonTeams.filter(team => {
    const matchesSearch = team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         team.city.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLeague = selectedLeague === 'all' || team.league === selectedLeague;
    return matchesSearch && matchesLeague;
  });

  const isFollowing = (teamId: string) => followedTeams.some(team => team.id === teamId);
  const isOnWaitlist = (teamId: string) => waitlistTeams.includes(teamId);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="text-muted-foreground">Loading teams...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background crt-effect">
      {/* Retro background effects */}
      <div className="fixed inset-0 pointer-events-none opacity-10">
        <div className="absolute inset-0 retro-grid"></div>
        <div className="absolute inset-0 retro-scanlines"></div>
      </div>

      <div className="container mx-auto px-4 py-6 relative">
        <div className="space-y-6">
          <div className="bg-card/50 backdrop-blur-sm border border-primary/20 rounded-lg p-6">
            <h1 className="text-3xl font-bold text-foreground font-arcade">TEAM DIRECTORY</h1>
            <p className="text-muted-foreground font-mono">Discover and follow your favorite NFL and NCAA teams</p>
          </div>

          {/* Search and Filter */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search teams..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Tabs value={selectedLeague} onValueChange={setSelectedLeague} className="w-full md:w-auto">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="NFL">NFL</TabsTrigger>
              <TabsTrigger value="NCAA">NCAA</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Trophy className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{totalActiveTeams}</p>
                  <p className="text-sm text-muted-foreground">Total Teams</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Users className="w-8 h-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{teams.filter(t => t.league === 'NFL' && t.status === 'active').length}</p>
                  <p className="text-sm text-muted-foreground">NFL Teams</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Users className="w-8 h-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{ncaaTeamCount}</p>
                  <p className="text-sm text-muted-foreground">NCAA Teams</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Heart className="w-8 h-8 text-red-500" />
                <div>
                  <p className="text-2xl font-bold">{followedTeams.length}</p>
                  <p className="text-sm text-muted-foreground">Following</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Clock className="w-8 h-8 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">{comingSoonTeams.length}</p>
                  <p className="text-sm text-muted-foreground">Coming Soon</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Teams Section */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Active Teams</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredActiveTeams.map((team) => (
              <Card key={team.id} className="transition-shadow hover:shadow-lg">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={team.logo_url} />
                        <AvatarFallback className="bg-primary/20 text-primary font-bold">
                          {team.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-base">{team.city}</CardTitle>
                        <p className="text-sm text-muted-foreground">{team.name}</p>
                      </div>
                    </div>
                    {user && (
                      <div className="flex flex-col gap-2">
                        <Button
                          variant={isFollowing(team.id) ? "default" : "outline"}
                          size="sm"
                          onClick={() => toggleFollow(team.id)}
                          className="flex items-center gap-1"
                        >
                          {isFollowing(team.id) ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <>
                              <Heart className="w-3 h-3" />
                              Follow
                            </>
                          )}
                        </Button>
                        <StartHuddleDialog 
                          trigger={
                            <Button
                              variant="secondary"
                              size="sm"
                              className="flex items-center gap-1 w-full"
                            >
                              <Users className="w-3 h-3" />
                              Start Huddle
                            </Button>
                          }
                        />
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Badge variant="secondary">{team.league}</Badge>
                      {team.conference && (
                        <Badge variant="outline">{team.conference}</Badge>
                      )}
                    </div>
                    
                    {team.division && (
                      <p className="text-sm text-muted-foreground">
                        {team.conference} {team.division}
                      </p>
                    )}
                    
                    {team.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {team.description}
                      </p>
                    )}
                    
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {filteredActiveTeams.length === 0 && (
            <Card>
              <CardContent className="text-center py-8">
                <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No active teams found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your search terms or filters
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Coming Soon Teams Section */}
        {filteredComingSoonTeams.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Launching Soon</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredComingSoonTeams.map((team) => (
                <Card key={team.id} className="transition-shadow hover:shadow-lg border-dashed">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-12 h-12 opacity-60">
                          <AvatarImage src={team.logo_url} />
                          <AvatarFallback className="bg-muted text-muted-foreground font-bold">
                            {team.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-base text-muted-foreground">{team.city}</CardTitle>
                          <p className="text-sm text-muted-foreground">{team.name}</p>
                        </div>
                      </div>
                      {user && (
                        <Button
                          variant={isOnWaitlist(team.id) ? "default" : "outline"}
                          size="sm"
                          onClick={() => joinWaitlist(team.id)}
                          disabled={isOnWaitlist(team.id)}
                          className="flex items-center gap-1"
                        >
                          {isOnWaitlist(team.id) ? (
                            <>
                              <Check className="w-3 h-3" />
                              On Waitlist
                            </>
                          ) : (
                            'Join Waitlist'
                          )}
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <Badge variant="outline" className="border-orange-500 text-orange-500">
                          Coming Soon
                        </Badge>
                        <Badge variant="secondary">{team.league}</Badge>
                        {team.conference && (
                          <Badge variant="outline">{team.conference}</Badge>
                        )}
                      </div>
                      
                      {team.division && (
                        <p className="text-sm text-muted-foreground">
                          {team.conference} {team.division}
                        </p>
                      )}
                      
                      <p className="text-sm text-muted-foreground">
                        Get notified when this team launches!
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Following Section */}
        {user && followedTeams.length > 0 && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold mb-4">Teams You Follow</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {followedTeams.map((team) => (
                <Card key={team.id} className="border-primary/50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={team.logo_url} />
                        <AvatarFallback className="bg-primary/20 text-primary font-bold">
                          {team.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{team.city} {team.name}</p>
                        <p className="text-xs text-muted-foreground">{team.league}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleFollow(team.id)}
                      >
                        <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  );
};