import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PostCard } from "@/components/PostCard";

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

export const SpotlightFeed = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSpotlightPosts();
  }, []);

  const fetchSpotlightPosts = async () => {
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
        .eq("is_spotlight", true)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setPosts(posts || []);
    } catch (error) {
      console.error("Error fetching spotlight posts:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading spotlight...</div>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <h3 className="text-xl font-semibold mb-2">No spotlight posts yet</h3>
        <p className="text-muted-foreground">Spotlight posts will appear here when admins feature them!</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="space-y-1">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} isSpotlight />
        ))}
      </div>
    </div>
  );
};