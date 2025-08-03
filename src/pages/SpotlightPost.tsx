import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PostCard } from "@/components/PostCard";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface SpotlightPost {
  id: string;
  content: string;
  media_url?: string;
  poll_data?: any;
  created_at: string;
  author_id?: string;
  team: {
    id: string;
    name: string;
    logo_url?: string;
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

export const SpotlightPost = () => {
  const { id } = useParams();
  const [post, setPost] = useState<SpotlightPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    
    fetchPost();
  }, [id]);

  const fetchPost = async () => {
    try {
      const { data: postData, error: postError } = await supabase
        .from("posts")
        .select(`
          id,
          content,
          media_url,
          embed_code,
          poll_data,
          created_at,
          author_id,
          is_team_agent_message,
          team:teams(id, name, logo_url),
          post_reactions(reaction_type)
        `)
        .eq('id', id)
        .contains('target_audience', ['spotlight'])
        .eq("delivery_status", "sent")
        .single();

      if (postError) throw postError;

      // Fetch author profile if available
      let authorData = null;
      if (postData.author_id) {
        const { data: author } = await supabase
          .from('profiles')
          .select('display_name, username, avatar_url')
          .eq('user_id', postData.author_id)
          .single();
        authorData = author;
      }

      setPost({
        ...postData,
        author: authorData
      });
    } catch (error) {
      console.error("Error fetching post:", error);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  if (!id) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading post...</div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <h3 className="text-xl font-semibold mb-2">Post not found</h3>
        <p className="text-muted-foreground mb-4">This spotlight post may have been removed or doesn't exist.</p>
        <Button onClick={() => window.location.href = '/'}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Feed
        </Button>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto p-4">
      <div className="mb-4">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => window.location.href = '/'}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Feed
        </Button>
      </div>
      
      <div className="bg-gradient-to-r from-spotlight/10 to-transparent rounded-lg p-4 mb-4">
        <h2 className="text-lg font-semibold text-spotlight mb-2">Spotlight Post</h2>
        <p className="text-sm text-muted-foreground">
          Join the conversation on Side Huddle to see more content like this!
        </p>
      </div>

      <PostCard post={post} isSpotlight />
    </div>
  );
};