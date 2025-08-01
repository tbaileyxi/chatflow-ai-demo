import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Send, Users, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { MediaUpload } from "@/components/MediaUpload";
import { MediaViewer } from "@/components/MediaViewer";
import { InviteButton } from "@/components/InviteButton";
import { CollapsibleMemberList } from "@/components/CollapsibleMemberList";

interface HuddleData {
  id: string;
  name: string;
  team: {
    id: string;
    name: string;
    logo_url?: string;
  };
  created_at: string;
}

interface Message {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  media_url?: string;
  media_type?: string;
  is_team_agent_message?: boolean;
  profiles?: {
    display_name?: string;
    username?: string;
    avatar_url?: string;
  } | null;
  reactions?: {
    [emoji: string]: {
      count: number;
      users: string[];
    };
  };
}

export const Huddle = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [huddle, setHuddle] = useState<HuddleData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);

  const scrollToBottom = () => {
    setTimeout(() => {
      window.scrollTo({ 
        top: document.body.scrollHeight, 
        behavior: 'smooth' 
      });
    }, 100);
  };

  useEffect(() => {
    if (id) {
      fetchHuddle();
      fetchMessages();
      
      // Auto-scroll to bottom on mount
      setTimeout(() => scrollToBottom(), 100);
      
      // Set up real-time subscription for messages with better performance
      const channel = supabase
        .channel(`huddle-messages-${id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'huddle_messages',
            filter: `huddle_id=eq.${id}`
          },
          (payload) => {
            // Add new message directly instead of refetching all
            addNewMessage(payload.new as any);
            // Auto-scroll to bottom on new message
            setTimeout(() => scrollToBottom(), 100);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [id]);

  const addNewMessage = async (newMessageData: any) => {
    // Fetch profile for the new message if not already available
    const { data: profileData } = await supabase
      .from("profiles")
      .select("user_id, display_name, username, avatar_url")
      .eq("user_id", newMessageData.user_id)
      .single();

    const messageWithProfile = {
      ...newMessageData,
      profiles: profileData
    };

    setMessages(prev => [...prev, messageWithProfile]);
  };

  const fetchHuddle = async () => {
    try {
      const { data, error } = await supabase
        .from("huddles")
        .select(`
          id,
          name,
          created_at,
          team:teams(id, name, logo_url)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      setHuddle(data);
    } catch (error) {
      console.error("Error fetching huddle:", error);
      toast({
        title: "Error",
        description: "Failed to load huddle",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      // First get messages
      const { data: messagesData, error: messagesError } = await supabase
        .from("huddle_messages")
        .select(`
          id,
          content,
          created_at,
          user_id,
          media_url,
          media_type,
          is_team_agent_message
        `)
        .eq("huddle_id", id)
        .order("created_at", { ascending: true });

      if (messagesError) throw messagesError;

      // Get unique user IDs
      const userIds = [...new Set(messagesData?.map(m => m.user_id) || [])];
      
      // Get profiles for these users
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", userIds);

      if (profilesError) throw profilesError;

      // Map profiles to messages
      const messagesWithProfiles = messagesData?.map(message => ({
        ...message,
        profiles: profilesData?.find(p => p.user_id === message.user_id) || null
      })) || [];

      setMessages(messagesWithProfiles);
      
      // Fetch reactions for all messages
      messagesWithProfiles.forEach(message => {
        fetchMessageReactions(message.id);
      });

      // Auto-scroll to bottom after loading messages
      setTimeout(() => scrollToBottom(), 100);
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user?.id) return;

    try {
      const { error } = await supabase
        .from("huddle_messages")
        .insert({
          huddle_id: id,
          user_id: user.id,
          content: newMessage.trim()
        });

      if (error) throw error;
      
      setNewMessage("");
      // No need to fetch messages - real-time will handle it
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      });
    }
  };

  const sendMediaMessage = async (mediaUrl: string, mediaType: 'image' | 'video', commentary?: string) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from("huddle_messages")
        .insert({
          huddle_id: id,
          user_id: user.id,
          content: commentary || '',
          media_url: mediaUrl,
          media_type: mediaType
        });

      if (error) throw error;
      
      // Close media dialog after successful upload
      setMediaDialogOpen(false);
      
      toast({
        title: "Success",
        description: `${mediaType === 'image' ? 'Image' : 'Video'} sent successfully`,
      });
      
    } catch (error) {
      console.error("Error sending media:", error);
      toast({
        title: "Error",
        description: "Failed to send media",
        variant: "destructive"
      });
    }
  };

  const addReaction = async (messageId: string, emoji: string) => {
    if (!user?.id) return;

    try {
      // Check if user already reacted with this emoji
      const { data: existingReaction } = await supabase
        .from("huddle_message_reactions")
        .select("id")
        .eq("message_id", messageId)
        .eq("user_id", user.id)
        .eq("emoji", emoji)
        .single();

      if (existingReaction) {
        // Remove reaction
        const { error } = await supabase
          .from("huddle_message_reactions")
          .delete()
          .eq("id", existingReaction.id);

        if (error) throw error;
      } else {
        // Add reaction
        const { error } = await supabase
          .from("huddle_message_reactions")
          .insert({
            message_id: messageId,
            user_id: user.id,
            emoji: emoji
          });

        if (error) throw error;
      }

      // Refresh reactions for this message
      fetchMessageReactions(messageId);
    } catch (error) {
      console.error("Error handling reaction:", error);
      toast({
        title: "Error",
        description: "Failed to update reaction",
        variant: "destructive"
      });
    }
  };

  const fetchMessageReactions = async (messageId: string) => {
    try {
      const { data: reactions, error } = await supabase
        .from("huddle_message_reactions")
        .select("emoji, user_id")
        .eq("message_id", messageId);

      if (error) throw error;

      // Group reactions by emoji
      const reactionCounts: { [emoji: string]: { count: number; users: string[] } } = {};
      reactions?.forEach((reaction) => {
        if (!reactionCounts[reaction.emoji]) {
          reactionCounts[reaction.emoji] = { count: 0, users: [] };
        }
        reactionCounts[reaction.emoji].count++;
        reactionCounts[reaction.emoji].users.push(reaction.user_id);
      });

      // Update message with reactions
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, reactions: reactionCounts }
          : msg
      ));
    } catch (error) {
      console.error("Error fetching reactions:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading huddle...</div>
      </div>
    );
  }

  if (!huddle) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h3 className="text-xl font-semibold mb-2">Huddle not found</h3>
          <p className="text-muted-foreground">This huddle may not exist or you don't have access to it.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Huddle Header */}
      <div className="p-4 border-b bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              {huddle.team.logo_url ? (
                <img src={huddle.team.logo_url} alt={huddle.team.name} className="w-8 h-8 rounded-full" />
              ) : (
                <span className="text-primary font-bold text-sm">
                  {huddle.team.name.substring(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <h2 className="font-bold text-lg">{huddle.name}</h2>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Users className="w-4 h-4" />
                {huddle.team.name} Side Huddle
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <InviteButton huddleId={huddle.id} />
          </div>
        </div>
        <div className="mt-3">
          <CollapsibleMemberList huddleId={huddle.id} />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => {
            const isCurrentUser = message.user_id === user?.id;
            const isTeamAgent = message.is_team_agent_message;
            
            return (
              <div 
                key={message.id} 
                className={`flex gap-2 ${isCurrentUser && !isTeamAgent ? 'flex-row-reverse' : ''}`}
              >
                {/* Avatar - only show for non-current user messages */}
                {(!isCurrentUser || isTeamAgent) && (
                  <Avatar className="w-7 h-7 flex-shrink-0">
                    <AvatarImage src={message.profiles?.avatar_url} />
                    <AvatarFallback className="text-xs">
                      {isTeamAgent ? 'TA' : 
                       (message.profiles?.display_name || message.profiles?.username) ? 
                       (message.profiles.display_name || message.profiles.username)!.substring(0, 2).toUpperCase() : 'U'}
                    </AvatarFallback>
                  </Avatar>
                )}
                
                <div className={`flex flex-col max-w-[80%] ${isCurrentUser && !isTeamAgent ? 'items-end ml-auto' : 'items-start'}`}>
                  {/* Sender name and timestamp - smaller and less prominent */}
                  <div className={`flex items-center gap-1 mb-1 px-1 ${isCurrentUser && !isTeamAgent ? 'flex-row-reverse' : ''}`}>
                    <span className="text-xs font-medium text-muted-foreground">
                      {isTeamAgent ? 'TEAM AGENT' : 
                       isCurrentUser ? 'You' : 
                       (message.profiles?.display_name || message.profiles?.username || 'Anonymous')}
                    </span>
                    <span className="text-xs text-muted-foreground/70">
                      {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  
                  {/* Message bubble */}
                  <div className={`
                    px-4 py-2 rounded-2xl max-w-full break-words
                    ${isCurrentUser && !isTeamAgent 
                      ? 'bg-primary text-primary-foreground rounded-br-md' 
                      : isTeamAgent 
                        ? 'bg-accent/50 text-accent-foreground border border-accent rounded-bl-md'
                        : 'bg-muted text-foreground rounded-bl-md'
                    }
                  `}>
                    {/* Message content - larger and more prominent */}
                    <p className="text-base leading-relaxed">{message.content}</p>
                    
                    {/* Media content */}
                    {message.media_url && message.media_type && (
                      <div className="mt-2 max-w-xs">
                        <MediaViewer
                          mediaUrl={message.media_url}
                          mediaType={message.media_type as 'image' | 'video'}
                          className="w-full h-auto rounded-lg"
                        />
                      </div>
                    )}
                  </div>
                  
                  {/* Emoji Reactions - smaller and positioned below bubble */}
                  {message.reactions && Object.keys(message.reactions).length > 0 && (
                    <div className="flex gap-1 mt-1 px-1">
                      {Object.entries(message.reactions).map(([emoji, data]) => {
                        const hasReacted = data.users.includes(user?.id || '');
                        const count = data.count;
                        
                        return (
                          <button
                            key={emoji}
                            className={`
                              text-xs px-2 py-1 rounded-full border transition-colors
                              ${hasReacted 
                                ? 'bg-primary/10 border-primary/20 text-primary' 
                                : 'bg-background border-border hover:bg-muted'
                              }
                            `}
                            onClick={() => addReaction(message.id, emoji)}
                          >
                            {emoji} {count}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* Quick reaction buttons */}
                  <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {['👍', '😂', '🔥'].map((emoji) => {
                      const reactionData = message.reactions?.[emoji];
                      const hasReacted = reactionData?.users.includes(user?.id || '');
                      
                      if (!hasReacted && (!reactionData || reactionData.count === 0)) {
                        return (
                          <button
                            key={emoji}
                            className="text-xs px-2 py-1 rounded-full bg-background border border-border hover:bg-muted transition-colors"
                            onClick={() => addReaction(message.id, emoji)}
                          >
                            {emoji}
                          </button>
                        );
                      }
                      return null;
                    })}
                  </div>
                </div>
                
                {/* Spacer for current user messages to maintain alignment */}
                {isCurrentUser && !isTeamAgent && <div className="w-7" />}
              </div>
            );
          })
        )}
      </div>

      {/* Message Input */}
      <Card className="m-4 p-3 border-0 border-t border-border rounded-none">
        <form onSubmit={sendMessage} className="flex gap-2 mb-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1"
          />
          <Dialog open={mediaDialogOpen} onOpenChange={setMediaDialogOpen}>
            <DialogTrigger asChild>
              <Button type="button" variant="outline" size="icon">
                <Plus className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="w-full max-w-md">
              <VisuallyHidden>
                <DialogTitle>Upload Media</DialogTitle>
                <DialogDescription>Upload an image or video to share in the chat</DialogDescription>
              </VisuallyHidden>
              <MediaUpload
                onMediaSelected={sendMediaMessage}
                bucket="chat-media"
                showPreview={true}
              />
            </DialogContent>
          </Dialog>
          <Button type="submit" disabled={!newMessage.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </Card>
    </div>
  );
};