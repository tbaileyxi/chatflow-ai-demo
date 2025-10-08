import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PostCard } from "@/components/PostCard";

interface Post {
  id: string;
  content: string;
  media_url?: string;
  embed_code?: string;
  poll_data?: any;
  created_at: string;
  author_id?: string;
  team: {
    id: string;
    name: string;
    logo_url?: string;
    sponsor?: string;
  };
  author?: {
    display_name?: string;
    username?: string;
    avatar_url?: string;
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
    
    // Set up real-time subscription for new spotlight posts
    const channel = supabase
      .channel('spotlight-posts')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'posts',
        filter: 'is_spotlight=eq.true'
      }, async (payload) => {
        console.log('New spotlight post detected:', payload);
        const newPost = payload.new as any;
        
        // Fetch team and author data for the new post
        const { data: team } = await supabase
          .from('teams')
          .select('id, name, logo_url, sponsor')
          .eq('id', newPost.team_id)
          .single();
        
        let author = null;
        if (newPost.author_id && !newPost.is_agent_post) {
          const { data: authorData } = await supabase
            .from('profiles')
            .select('user_id, display_name, username, avatar_url')
            .eq('user_id', newPost.author_id)
            .single();
          author = authorData;
        }
        
        const enrichedPost = {
          ...newPost,
          team,
          author,
          post_reactions: []
        };
        
        // Prepend new post to the top of the feed
        setPosts(prev => [enrichedPost, ...prev]);
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchSpotlightPosts = async () => {
    try {
      const { data: posts, error } = await supabase
        .from("posts")
        .select(`
          id,
          content,
          media_url,
          embed_code,
          embeds,
          message_type,
          poll_data,
          created_at,
          author_id,
          is_agent_post,
          team:teams!team_id(id, name, logo_url, sponsor),
          post_reactions(reaction_type)
        `)
        .eq('is_spotlight', true)
        .contains('target_audience', ['spotlight'])
        .eq("delivery_status", "sent")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      // Fetch author profiles for posts that have authors
      const postsWithAuthors = posts || [];
      const authorIds = [...new Set(postsWithAuthors
        .filter(post => post.author_id)
        .map(post => post.author_id)
      )];

      let authorsMap: Record<string, any> = {};
      if (authorIds.length > 0) {
        const { data: authors } = await supabase
          .from('profiles')
          .select('user_id, display_name, username, avatar_url')
          .in('user_id', authorIds);

        if (authors) {
          authorsMap = authors.reduce((acc, author) => {
            acc[author.user_id] = author;
            return acc;
          }, {} as Record<string, any>);
        }
      }

      // Attach author data to posts, but only for non-agent posts
      const enrichedPosts = postsWithAuthors.map(post => ({
        ...post,
        author: (post.author_id && !post.is_agent_post) ? authorsMap[post.author_id] : null
      }));

      setPosts(enrichedPosts);
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
        <h3 className="text-xl font-semibold mb-2">No spotlight content yet</h3>
        <p className="text-muted-foreground">Spotlight posts will appear here!</p>
      </div>
    );
  }


  return (
    <div className="flex-1 overflow-y-auto">
      <div className="space-y-1">
        {posts.map((post) => (
          <PostCard key={`post-${post.id}`} post={post} isSpotlight />
        ))}
      </div>
    </div>
  );
};