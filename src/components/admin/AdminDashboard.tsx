import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Users, MessageSquare, Shield, Trophy, Home, ArrowLeft, Play, Rss, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

interface DashboardStats {
  totalUsers: number;
  totalTeams: number;
  totalPosts: number;
  totalHuddles: number;
}

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalTeams: 0,
    totalPosts: 0,
    totalHuddles: 0
  });
  const [loading, setLoading] = useState(true);
  const [scoringLoading, setScoringLoading] = useState(false);
  const [redditBuzzLoading, setRedditBuzzLoading] = useState(false);
  const [resetLimitsLoading, setResetLimitsLoading] = useState(false);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const [usersRes, teamsRes, postsRes, huddlesRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('teams').select('id', { count: 'exact', head: true }),
        supabase.from('posts').select('id', { count: 'exact', head: true }),
        supabase.from('huddles').select('id', { count: 'exact', head: true })
      ]);

      setStats({
        totalUsers: usersRes.count || 0,
        totalTeams: teamsRes.count || 0,
        totalPosts: postsRes.count || 0,
        totalHuddles: huddlesRes.count || 0
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const testScoring = async () => {
    setScoringLoading(true);
    try {
      console.log('Triggering scoring function...');
      const { data, error } = await supabase.functions.invoke('pickem-scoring');
      
      if (error) {
        console.error('Scoring error:', error);
        toast({
          title: "Scoring Failed",
          description: `Error: ${error.message}`,
          variant: "destructive",
        });
      } else {
        console.log('Scoring result:', data);
        toast({
          title: "Scoring Complete",
          description: `Updated ${data?.updated || 0} games out of ${data?.total_checked || 0} checked`,
        });
      }
    } catch (error) {
      console.error('Failed to trigger scoring:', error);
      toast({
        title: "Scoring Failed",
        description: "Failed to trigger scoring function",
        variant: "destructive",
      });
    } finally {
      setScoringLoading(false);
    }
  };

  const triggerRedditBuzz = async () => {
    setRedditBuzzLoading(true);
    try {
      console.log('Triggering Reddit social buzz function...');
      const { data, error } = await supabase.functions.invoke('reddit-social-buzz');
      
      if (error) {
        console.error('Reddit buzz error:', error);
        toast({
          title: "Reddit Buzz Failed",
          description: `Error: ${error.message}`,
          variant: "destructive",
        });
      } else {
        console.log('Reddit buzz result:', data);
        const atLimit = data?.teams_at_daily_limit || 0;
        const limitMsg = atLimit > 0 ? ` (${atLimit} teams at daily limit)` : '';
        toast({
          title: "Reddit Buzz Complete",
          description: `Processed ${data?.teams_processed || 0} teams, posted ${data?.total_posts || 0} messages${limitMsg}`,
        });
      }
    } catch (error) {
      console.error('Failed to trigger Reddit buzz:', error);
      toast({
        title: "Reddit Buzz Failed",
        description: "Failed to trigger Reddit buzz function",
        variant: "destructive",
      });
    } finally {
      setRedditBuzzLoading(false);
    }
  };

  const resetDailyLimits = async () => {
    setResetLimitsLoading(true);
    try {
      console.log('Resetting Reddit daily limits...');
      const { error } = await supabase
        .from('reddit_daily_counts')
        .delete()
        .gte('post_date', new Date().toISOString().split('T')[0]);
      
      if (error) {
        console.error('Reset error:', error);
        toast({
          title: "Reset Failed",
          description: `Error: ${error.message}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Daily Limits Reset",
          description: "Reddit daily post limits have been cleared for today",
        });
      }
    } catch (error) {
      console.error('Failed to reset limits:', error);
      toast({
        title: "Reset Failed",
        description: "Failed to reset daily limits",
        variant: "destructive",
      });
    } finally {
      setResetLimitsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="text-muted-foreground">Loading dashboard stats...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Admin Dashboard</h2>
          <p className="text-muted-foreground">Overview of your platform's key metrics</p>
        </div>
        <Button
          onClick={() => navigate('/app')}
          variant="outline"
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Return to App
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">Registered users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Teams</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.totalTeams}</div>
            <p className="text-xs text-muted-foreground">NFL & NCAA teams</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.totalPosts}</div>
            <p className="text-xs text-muted-foreground">Broadcast messages</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Side Huddles</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.totalHuddles}</div>
            <p className="text-xs text-muted-foreground">Private chats</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                <div>
                  <p className="font-medium">New user registered</p>
                  <p className="text-sm text-muted-foreground">2 minutes ago</p>
                </div>
                <Users className="h-4 w-4 text-green-500" />
              </div>
              <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                <div>
                  <p className="font-medium">Spotlight post created</p>
                  <p className="text-sm text-muted-foreground">5 minutes ago</p>
                </div>
                <MessageSquare className="h-4 w-4 text-blue-500" />
              </div>
              <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                <div>
                  <p className="font-medium">New side huddle started</p>
                  <p className="text-sm text-muted-foreground">15 minutes ago</p>
                </div>
                <Shield className="h-4 w-4 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Health & Tools</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Database Status</span>
                <span className="text-sm text-green-500 font-medium">Operational</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">API Response Time</span>
                <span className="text-sm text-green-500 font-medium">Fast</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Storage Usage</span>
                <span className="text-sm text-yellow-500 font-medium">Normal</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Active Sessions</span>
                <span className="text-sm text-green-500 font-medium">{stats.totalUsers}</span>
              </div>
              <div className="border-t border-border pt-4">
                <Button
                  onClick={testScoring}
                  disabled={scoringLoading}
                  className="w-full flex items-center gap-2"
                  variant="outline"
                >
                  <Play className="h-4 w-4" />
                  {scoringLoading ? 'Testing Scoring...' : 'Test Pick\'Em Scoring'}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Manually trigger the scoring function to update game results
                </p>
              </div>
              <div className="border-t border-border pt-4">
                <Button
                  onClick={triggerRedditBuzz}
                  disabled={redditBuzzLoading}
                  className="w-full flex items-center gap-2"
                  variant="outline"
                >
                  <Rss className="h-4 w-4" />
                  {redditBuzzLoading ? 'Fetching Reddit Buzz...' : 'Run Reddit Buzz Now'}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Manually fetch and post Reddit social buzz to team huddles
                </p>
                <Button
                  onClick={resetDailyLimits}
                  disabled={resetLimitsLoading}
                  className="w-full flex items-center gap-2 mt-2"
                  variant="ghost"
                  size="sm"
                >
                  <RotateCcw className="h-3 w-3" />
                  {resetLimitsLoading ? 'Resetting...' : 'Reset Daily Limits'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};