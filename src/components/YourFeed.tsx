import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PostCard } from "@/components/PostCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MediaViewer } from "@/components/MediaViewer";

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
  is_team_agent_message?: boolean;
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
      if (followedTeams.length === 0) {
        setPosts([]);
        return;
      }

      const { data: posts, error } = await supabase
        .from("posts")
        .select(`
          id,
          content,
          media_url,
          poll_data,
          created_at,
          target_audience,
          team:teams(id, name, logo_url),
          post_reactions(reaction_type)
        `)
        .in("team_id", followedTeams)
        .contains("target_audience", ["team_feed"])
        .eq("delivery_status", "sent")
        .order("created_at", { ascending: false })
        .limit(15);

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

      // CRITICAL FIX: Only fetch team agent broadcast messages from followed teams
      // Get user's followed teams first
      const { data: userFollows, error: followsError } = await supabase
        .from('user_follows')
        .select('team_id')
        .eq('user_id', user.user.id);

      if (followsError) throw followsError;

      const followedTeamIds = userFollows?.map(f => f.team_id) || [];
      if (followedTeamIds.length === 0) {
        setLoading(false);
        return;
      }

      // Get huddles for followed teams only
      const { data: teamHuddles, error: huddlesError } = await supabase
        .from('huddles')
        .select('id, name, team_id, team:teams(name)')
        .in('team_id', followedTeamIds);

      if (huddlesError) throw huddlesError;

      const huddleIds = teamHuddles?.map(h => h.id) || [];
      if (huddleIds.length === 0) {
        setLoading(false);
        return;
      }

      // Get team agent messages, but exclude ones that already have corresponding posts
      // First get post IDs that are team agent messages for these teams
      const { data: existingPosts } = await supabase
        .from('posts')
        .select('id, created_at')
        .in('team_id', followedTeamIds)
        .eq('is_team_agent_message', true)
        .eq('delivery_status', 'sent');

      // ONLY get team agent messages (broadcasts) - NO private user messages
      const { data: messages, error: messagesError } = await supabase
        .from('huddle_messages')
        .select(`
          id,
          content,
          media_url,
          media_type,
          created_at,
          user_id,
          huddle_id,
          is_team_agent_message
        `)
        .in('huddle_id', huddleIds)
        .eq('is_team_agent_message', true)  // CRITICAL: Only team agent messages
        .order('created_at', { ascending: false })
        .limit(10);

      if (messagesError) throw messagesError;

      if (messages && messages.length > 0) {
        // Filter out messages that correspond to existing posts (to prevent duplicates)
        const filteredMessages = messages.filter(message => {
          // Check if there's a post with similar timestamp (within 5 minutes)
          const messageTime = new Date(message.created_at).getTime();
          return !existingPosts?.some(post => {
            const postTime = new Date(post.created_at).getTime();
            return Math.abs(messageTime - postTime) < 5 * 60 * 1000; // 5 minutes tolerance
          });
        });

        // Combine data with huddle info already fetched
        const enrichedMessages: HuddleMessage[] = filteredMessages.map(message => {
          const huddle = teamHuddles?.find(h => h.id === message.huddle_id);
          return {
            ...message,
            huddle_name: huddle?.name || 'Unknown Huddle',
            team_name: huddle?.team?.name || 'Unknown Team',
            display_name: 'TEAM AGENT',
            username: 'team_agent',
            avatar_url: null
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
              <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                <MediaViewer
                  mediaUrl={message.media_url}
                  mediaType={message.media_type === 'video' ? 'video' : 'image'}
                  className="max-w-xs rounded-lg"
                />
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