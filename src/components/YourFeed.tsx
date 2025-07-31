import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PostCard } from "@/components/PostCard";
import { Button } from "@/components/ui/button";

interface Post {
  id: string;
  content: string;
  media_url?: string;
  poll_data?: any;
  created_at: string;
  team: {
    id: string;
    name: string;
    logo_url?: string;
  };
  post_reactions: Array<{
    reaction_type: string;
  }>;
}

export const YourFeed = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [followedTeams, setFollowedTeams] = useState<string[]>([]);

  useEffect(() => {
    fetchFollowedTeams();
  }, []);

  useEffect(() => {
    if (followedTeams.length > 0) {
      fetchPosts();
    } else {
      setLoading(false);
    }
  }, [followedTeams]);

  const fetchFollowedTeams = async () => {
    try {
      // Get actual followed teams from user_follows table
      const { data, error } = await supabase
        .from('user_follows')
        .select('team_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

      if (error) throw error;
      
      const teamIds = data?.map(follow => follow.team_id) || [];
      setFollowedTeams(teamIds);
    } catch (error) {
      console.error('Error fetching followed teams:', error);
      setFollowedTeams([]);
    }
  };

  const fetchPosts = async () => {
    try {
      const { data: posts, error } = await supabase
        .from("posts")
        .select(`
          id,
          content,
          media_url,
          poll_data,
          created_at,
          team:teams(id, name, logo_url),
          post_reactions(reaction_type)
        `)
        .in("team_id", followedTeams)
        .eq("is_spotlight", false)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setPosts(posts || []);
    } catch (error) {
      console.error("Error fetching posts:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading your feed...</div>
      </div>
    );
  }

  if (followedTeams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <h3 className="text-xl font-semibold mb-4">Follow teams to see your feed</h3>
        <Button onClick={() => window.location.href = '/teams'} className="mt-4">
          Follow Teams
        </Button>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <h3 className="text-xl font-semibold mb-2">No posts yet</h3>
        <p className="text-muted-foreground mb-4">Check back later for updates from your teams!</p>
        <Button onClick={() => window.location.href = '/teams'}>
          Follow More Teams
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="text-lg font-semibold">Your Feed</h2>
        <Button variant="outline" size="sm" onClick={() => window.location.href = '/teams'}>
          Follow Teams
        </Button>
      </div>
      <div className="space-y-1">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  );
};