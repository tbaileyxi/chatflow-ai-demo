import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, TrendingUp, ExternalLink, Play } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BearsTrendingPost {
  id: string;
  post_id: string;
  embed_url: string;
  content: string;
  author_username: string;
  likes: number;
  retweets: number;
  rank_score: number;
  created_at: string;
  fetched_at: string;
}

export const BearsTrendingManager = () => {
  const [posts, setPosts] = useState<BearsTrendingPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchTrendingPosts();
  }, []);

  const fetchTrendingPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('bears_trending')
        .select('*')
        .order('rank_score', { ascending: false })
        .limit(20);

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error('Error fetching trending posts:', error);
      toast({
        title: "Error",
        description: "Failed to fetch trending posts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const triggerFetch = async () => {
    setFetching(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-bears-trending');
      
      if (error) throw error;
      
      toast({
        title: "Success",
        description: `Fetched ${data.processed} new trending posts`,
      });
      
      // Refresh the local data
      await fetchTrendingPosts();
    } catch (error) {
      console.error('Error triggering fetch:', error);
      toast({
        title: "Error",
        description: "Failed to fetch new trending posts",
        variant: "destructive",
      });
    } finally {
      setFetching(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    return 'Just now';
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="text-muted-foreground">Loading trending posts...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Bears Trending Feed</h2>
          <p className="text-muted-foreground">Manage and view trending Bears content from Twitter</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchTrendingPosts} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={triggerFetch} disabled={fetching}>
            <Play className={`h-4 w-4 mr-2 ${fetching ? 'animate-spin' : ''}`} />
            Fetch New Posts
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Trending Posts ({posts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {posts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No trending posts found. Click "Fetch New Posts" to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <div key={post.id} className="border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">@{post.author_username}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {formatTimeAgo(post.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>❤️ {post.likes}</span>
                      <span>🔄 {post.retweets}</span>
                      <Badge variant="outline">Score: {post.rank_score}</Badge>
                    </div>
                  </div>
                  
                  <p className="text-sm mb-3 line-clamp-3">{post.content}</p>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Fetched {formatTimeAgo(post.fetched_at)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(post.embed_url, '_blank')}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      View Tweet
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configuration Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
            <h4 className="font-medium mb-2">Using Private Lists</h4>
            <p className="text-sm text-muted-foreground">
              To pull from your private Twitter lists instead of public search:
            </p>
            <ol className="text-sm text-muted-foreground mt-2 space-y-1 ml-4 list-decimal">
              <li>Get your Twitter API v2 Bearer Token with List access</li>
              <li>Find your Twitter List IDs from your account</li>
              <li>Update the edge function to use the Lists API endpoint</li>
              <li>Create separate lists for each team you want to track</li>
            </ol>
          </div>
          
          <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
            <h4 className="font-medium mb-2">Team-Specific Feeds</h4>
            <p className="text-sm text-muted-foreground">
              To create feeds for different teams, you can:
            </p>
            <ul className="text-sm text-muted-foreground mt-2 space-y-1 ml-4 list-disc">
              <li>Create multiple edge functions (one per team)</li>
              <li>Add a team_id column to the bears_trending table</li>
              <li>Use different search queries or list IDs per team</li>
              <li>Filter the display by team in this interface</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};