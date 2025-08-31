import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { PostCard } from '@/components/PostCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Heart, Check, Users } from 'lucide-react';

interface Team {
  id: string;
  name: string;
  city: string;
  league: string;
  conference?: string;
  division?: string;
  logo_url?: string;
  description?: string;
  status: string;
}

interface Post {
  id: string;
  content: string;
  media_url?: string;
  embed_code?: string;
  message_type?: string;
  created_at: string;
  author_id?: string;
  team_id?: string;
  is_spotlight: boolean;
  poll_data?: any;
  teams?: {
    name: string;
    city: string;
    logo_url?: string;
  };
  origin_teams?: {
    name: string;
    city: string;
    logo_url?: string;
  };
}

export const TeamFeed = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [team, setTeam] = useState<Team | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);

  useEffect(() => {
    if (teamId) {
      fetchTeam();
      fetchPosts();
      if (user) {
        checkFollowStatus();
      }
    }
  }, [teamId, user]);

  const fetchTeam = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single();

      if (error) throw error;
      setTeam(data);
    } catch (error) {
      console.error('Error fetching team:', error);
      toast({
        title: "Error",
        description: "Failed to load team information",
        variant: "destructive"
      });
      navigate('/app');
    } finally {
      setLoading(false);
    }
  };

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          id,
          content,
          media_url,
          embed_code,
          message_type,
          created_at,
          author_id,
          team_id,
          origin_team_id,
          is_spotlight,
          poll_data,
          teams!team_id(name, city, logo_url),
          origin_teams:teams!origin_team_id(name, city, logo_url)
        `)
        .eq('team_id', teamId)
        .contains('target_audience', ['team_feed'])
        .eq('delivery_status', 'sent')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast({
        title: "Error",
        description: "Failed to load team posts",
        variant: "destructive"
      });
    } finally {
      setPostsLoading(false);
    }
  };

  const checkFollowStatus = async () => {
    if (!user || !teamId) return;

    try {
      const { data, error } = await supabase
        .from('user_follows')
        .select('id')
        .eq('user_id', user.id)
        .eq('team_id', teamId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setIsFollowing(!!data);
    } catch (error) {
      console.error('Error checking follow status:', error);
    }
  };

  const toggleFollow = async () => {
    if (!user || !teamId) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to follow teams",
        variant: "destructive"
      });
      return;
    }

    try {
      if (isFollowing) {
        const { error } = await supabase
          .from('user_follows')
          .delete()
          .eq('user_id', user.id)
          .eq('team_id', teamId);

        if (error) throw error;
        setIsFollowing(false);
        toast({
          title: "Success",
          description: "Team unfollowed"
        });
      } else {
        const { error } = await supabase
          .from('user_follows')
          .insert({
            user_id: user.id,
            team_id: teamId
          });

        if (error) throw error;
        setIsFollowing(true);
        toast({
          title: "Success",
          description: "Team followed!"
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

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="text-muted-foreground">Loading team...</div>
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Team Not Found</h2>
          <Button onClick={() => navigate('/app')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Huddles
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/app')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </div>

        {/* Team Info Card */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16">
                  <AvatarImage src={team.logo_url} />
                  <AvatarFallback className="bg-primary/20 text-primary font-bold text-lg">
                    {team.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-2xl">{team.city} {team.name}</CardTitle>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="secondary">{team.league}</Badge>
                    {team.conference && (
                      <Badge variant="outline">{team.conference}</Badge>
                    )}
                  </div>
                  {team.division && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {team.conference} {team.division}
                    </p>
                  )}
                </div>
              </div>
              
              {user && (
                <Button
                  onClick={toggleFollow}
                  variant={isFollowing ? "default" : "outline"}
                  className="flex items-center gap-2"
                >
                  {isFollowing ? (
                    <>
                      <Check className="w-4 h-4" />
                      Following
                    </>
                  ) : (
                    <>
                      <Heart className="w-4 h-4" />
                      Follow Team
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardHeader>
          {team.description && (
            <CardContent>
              <p className="text-muted-foreground">{team.description}</p>
            </CardContent>
          )}
        </Card>

        {/* Posts Feed */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Users className="w-5 h-5" />
            Team Feed
          </h2>
          
          {postsLoading ? (
            <div className="text-center py-8">
              <div className="text-muted-foreground">Loading posts...</div>
            </div>
          ) : posts.length > 0 ? (
            <div className="space-y-4">
              {posts.map((post) => (
                  <PostCard 
                  key={post.id}
                  post={{
                    ...post,
                    team: {
                      id: post.team_id || '',
                      name: post.teams?.name || '',
                      logo_url: post.teams?.logo_url,
                      sponsor: ''
                    },
                    origin_teams: post.origin_teams,
                    post_reactions: []
                  }}
                  isSpotlight={false}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No posts yet</h3>
                <p className="text-muted-foreground">
                  This team hasn't posted any content yet. Check back later!
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};