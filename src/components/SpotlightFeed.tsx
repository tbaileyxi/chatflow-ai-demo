import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PostCard } from "@/components/PostCard";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, Crown } from "lucide-react";
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

interface AgentMessage {
  id: string;
  content: string;
  media_url?: string;
  media_type: string;
  created_at: string;
  user_id: string;
  huddle_id: string;
  huddle_name: string;
  team_name: string;
  is_agent: boolean;
  is_team_agent_message?: boolean;
}

export const SpotlightFeed = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchSpotlightPosts();
    fetchAgentMessages();
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
        .limit(10);

      if (error) throw error;
      setPosts(posts || []);
    } catch (error) {
      console.error("Error fetching spotlight posts:", error);
    }
  };

  const fetchAgentMessages = async () => {
    try {
      // Get team agent messages from huddles
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
        .eq('is_team_agent_message', true)
        .order('created_at', { ascending: false })
        .limit(10);

      if (messagesError) throw messagesError;

      if (messages && messages.length > 0) {
        // Get huddle and team details
        const huddleIds = [...new Set(messages.map(m => m.huddle_id))];
        const { data: huddles } = await supabase
          .from('huddles')
          .select(`
            id,
            name,
            team:teams(name)
          `)
          .in('id', huddleIds);

        // Combine data
        const enrichedMessages: AgentMessage[] = messages.map(message => {
          const huddle = huddles?.find(h => h.id === message.huddle_id);
          return {
            ...message,
            huddle_name: huddle?.name || 'Unknown Huddle',
            team_name: huddle?.team?.name || 'Unknown Team',
            is_agent: true,
            is_team_agent_message: message.is_team_agent_message
          };
        });

        setAgentMessages(enrichedMessages);
      }
    } catch (error) {
      console.error("Error fetching agent messages:", error);
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

  if (posts.length === 0 && agentMessages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <h3 className="text-xl font-semibold mb-2">No spotlight content yet</h3>
        <p className="text-muted-foreground">Spotlight posts and agent messages will appear here!</p>
      </div>
    );
  }

  const renderAgentMessage = (message: AgentMessage) => (
    <Card key={`agent-${message.id}`} className="cursor-pointer hover:bg-accent/5 border-l-4 border-l-amber-500" onClick={() => navigate(`/huddle/${message.huddle_id}`)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Crown className="w-5 h-5 text-amber-500 mt-1" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm text-amber-600">
                {message.is_team_agent_message ? 'TEAM AGENT' : 'Official Message'}
              </span>
              <span className="text-xs text-muted-foreground">in</span>
              <span className="text-sm font-medium text-primary">{message.huddle_name}</span>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">{message.team_name}</span>
            </div>
            <p className="text-sm text-foreground/80 line-clamp-3">{message.content}</p>
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
    ...agentMessages.map(message => ({ type: 'agent', data: message, created_at: message.created_at }))
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="space-y-1">
        {allContent.map((item, index) => (
          item.type === 'post' 
            ? <PostCard key={`post-${item.data.id}`} post={item.data as Post} isSpotlight />
            : renderAgentMessage(item.data as AgentMessage)
        ))}
      </div>
    </div>
  );
};