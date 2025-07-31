import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PostCard } from "@/components/PostCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

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

interface HuddleMessage {
  id: string;
  content: string;
  media_url?: string;
  media_type: string;
  created_at: string;
  user_id: string;
  huddle_id: string;
  huddle_name: string;
  team_name: string;
  display_name?: string;
  username?: string;
  avatar_url?: string;
}

export const YourFeed = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [huddleMessages, setHuddleMessages] = useState<HuddleMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [followedTeams, setFollowedTeams] = useState<string[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchFollowedTeams();
  }, []);

  useEffect(() => {
    if (followedTeams.length > 0) {
      fetchPosts();
    }
    fetchHuddleMessages();
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
        .limit(10);

      if (error) throw error;
      setPosts(posts || []);
    } catch (error) {
      console.error("Error fetching posts:", error);
    }
  };

  const fetchHuddleMessages = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      // Get user's huddles
      const { data: userHuddles, error: huddlesError } = await supabase
        .from('huddle_members')
        .select('huddle_id')
        .eq('user_id', user.user.id);

      if (huddlesError) throw huddlesError;

      const huddleIds = userHuddles?.map(h => h.huddle_id) || [];
      if (huddleIds.length === 0) {
        setLoading(false);
        return;
      }

      // Get recent messages from user's huddles
      const { data: messages, error: messagesError } = await supabase
        .from('huddle_messages')
        .select(`
          id,
          content,
          media_url,
          media_type,
          created_at,
          user_id,
          huddle_id
        `)
        .in('huddle_id', huddleIds)
        .order('created_at', { ascending: false })
        .limit(10);

      if (messagesError) throw messagesError;

      if (messages && messages.length > 0) {
        // Get huddle details
        const { data: huddles } = await supabase
          .from('huddles')
          .select(`
            id,
            name,
            team:teams(name)
          `)
          .in('id', [...new Set(messages.map(m => m.huddle_id))]);

        // Get user profiles
        const userIds = [...new Set(messages.map(m => m.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name, username, avatar_url')
          .in('user_id', userIds);

        // Combine data
        const enrichedMessages: HuddleMessage[] = messages.map(message => {
          const huddle = huddles?.find(h => h.id === message.huddle_id);
          const profile = profiles?.find(p => p.user_id === message.user_id);
          return {
            ...message,
            huddle_name: huddle?.name || 'Unknown Huddle',
            team_name: huddle?.team?.name || 'Unknown Team',
            display_name: profile?.display_name,
            username: profile?.username,
            avatar_url: profile?.avatar_url
          };
        });

        setHuddleMessages(enrichedMessages);
      }
    } catch (error) {
      console.error("Error fetching huddle messages:", error);
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

  if (posts.length === 0 && huddleMessages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <h3 className="text-xl font-semibold mb-4">Your feed is empty</h3>
        <div className="space-y-2 text-center">
          <Button onClick={() => window.location.href = '/teams'} className="mr-2">
            Follow Teams
          </Button>
          <p className="text-sm text-muted-foreground">
            Or join a huddle to see messages in your feed
          </p>
        </div>
      </div>
    );
  }

  const renderHuddleMessage = (message: HuddleMessage) => (
    <Card key={`huddle-${message.id}`} className="cursor-pointer hover:bg-accent/5" onClick={() => navigate(`/huddle/${message.huddle_id}`)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <MessageSquare className="w-5 h-5 text-primary mt-1" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm">{message.display_name || message.username || 'Anonymous'}</span>
              <span className="text-xs text-muted-foreground">in</span>
              <span className="text-sm font-medium text-primary">{message.huddle_name}</span>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">{message.team_name}</span>
            </div>
            <p className="text-sm text-foreground/80 line-clamp-2">{message.content}</p>
            {message.media_url && (
              <div className="text-xs text-muted-foreground mt-1">
                {message.media_type === 'image' ? '📷 Image' : '🎥 Video'}
              </div>
            )}
            <span className="text-xs text-muted-foreground">
              {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Combine and sort all content by creation time
  const allContent = [
    ...posts.map(post => ({ type: 'post', data: post, created_at: post.created_at })),
    ...huddleMessages.map(message => ({ type: 'huddle', data: message, created_at: message.created_at }))
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="text-lg font-semibold">Your Feed</h2>
        <Button variant="outline" size="sm" onClick={() => window.location.href = '/teams'}>
          Follow Teams
        </Button>
      </div>
      <div className="space-y-1">
        {allContent.map((item, index) => (
          item.type === 'post' 
            ? <PostCard key={`post-${item.data.id}`} post={item.data as Post} />
            : renderHuddleMessage(item.data as HuddleMessage)
        ))}
      </div>
    </div>
  );
};