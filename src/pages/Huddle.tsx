import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Send, Users, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { MediaUpload } from "@/components/MediaUpload";
import { MediaViewer } from "@/components/MediaViewer";
import { TwitterEmbed } from "@/components/PostCard";
import { InviteButton } from "@/components/InviteButton";
import { CollapsibleMemberList } from "@/components/CollapsibleMemberList";
import { MakePublicButton } from "@/components/MakePublicButton";
import { HuddleManagement } from "@/components/HuddleManagement";
import { VirtualizedChat } from "@/components/chat/VirtualizedChat";
import { LazyEmbed } from "@/components/chat/LazyEmbed";

interface HuddleData {
  id: string;
  name: string;
  owner_id: string;
  team: {
    id: string;
    name: string;
    logo_url?: string;
    sponsor?: string;
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
  embed_code?: string;
  poll_data?: any;
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
  const [pollVotes, setPollVotes] = useState<{[messageId: string]: any[]}>({});
  const [userVotes, setUserVotes] = useState<{[messageId: string]: number | null}>({});
  const PAGE_SIZE = 40;
  const [oldestCreatedAt, setOldestCreatedAt] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const scrollToBottom = () => {
    setTimeout(() => {
      window.scrollTo({ 
        top: document.body.scrollHeight, 
        behavior: 'smooth' 
      });
    }, 100);
  };

  const markMessagesAsRead = async () => {
    if (!user?.id || !id) return;
    
    try {
      await supabase
        .from('huddle_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('huddle_id', id)
        .eq('user_id', user.id);
      
      // Trigger a custom event to update the red dot in the header
      window.dispatchEvent(new CustomEvent('huddleRead', { detail: { huddleId: id } }));
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  useEffect(() => {
    if (id && user) {
      fetchHuddle();
      fetchMessages();
      
      // Mark messages as read when entering the huddle
      markMessagesAsRead();
      
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
  }, [id, user]);

  const addNewMessage = async (newMessageData: any) => {
    // Fetch profile for the new message if not already available
    const { data: profileData } = await supabase.rpc('get_public_profile', { 
      target_user_id: newMessageData.user_id 
    });

    const messageWithProfile = {
      ...newMessageData,
      profiles: profileData?.[0] || null
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
          owner_id,
          team:teams(id, name, logo_url, sponsor)
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
      // Fetch latest page of messages
      const { data: messagesData, error: messagesError } = await supabase
        .from("huddle_messages")
        .select(`
          id,
          content,
          created_at,
          user_id,
          media_url,
          media_type,
          embed_code,
          poll_data,
          is_team_agent_message
        `)
        .eq("huddle_id", id)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (messagesError) throw messagesError;

      const reversed = (messagesData || []).slice().reverse();

      // Get unique user IDs
      const userIds = [...new Set(reversed.map(m => m.user_id).filter(Boolean))];
      const profilePromises = userIds.map(userId => 
        supabase.rpc('get_public_profile', { target_user_id: userId })
      );
      const profileResults = await Promise.all(profilePromises);
      const profilesData = profileResults.map(result => result.data?.[0]).filter(Boolean);

      const messagesWithProfiles = reversed.map(message => ({
        ...message,
        profiles: profilesData?.find(p => p.user_id === message.user_id) || null
      }));

      setMessages(messagesWithProfiles);
      setOldestCreatedAt(messagesWithProfiles[0]?.created_at || null);
      setHasMore((messagesData?.length || 0) === PAGE_SIZE);

      // Fetch reactions and poll votes for visible messages
      messagesWithProfiles.forEach(message => {
        fetchMessageReactions(message.id);
        if (message.poll_data) {
          fetchPollVotes(message.id);
        }
      });

      // Auto-scroll to bottom after loading messages
      setTimeout(() => scrollToBottom(), 100);
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  const loadOlderMessages = async () => {
    if (!hasMore || loadingOlder || !oldestCreatedAt) return;
    setLoadingOlder(true);
    try {
      const { data: olderData, error } = await supabase
        .from("huddle_messages")
        .select(`
          id,
          content,
          created_at,
          user_id,
          media_url,
          media_type,
          embed_code,
          poll_data,
          is_team_agent_message
        `)
        .eq("huddle_id", id)
        .lt('created_at', oldestCreatedAt)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (error) throw error;

      const batch = (olderData || []).slice().reverse();

      // Fetch profiles for new users in this batch
      const userIds = [...new Set(batch.map(m => m.user_id).filter(Boolean))];
      const profilePromises = userIds.map(userId => 
        supabase.rpc('get_public_profile', { target_user_id: userId })
      );
      const profileResults = await Promise.all(profilePromises);
      const profilesData = profileResults.map(result => result.data?.[0]).filter(Boolean);

      const batchWithProfiles = batch.map(message => ({
        ...message,
        profiles: profilesData?.find(p => p.user_id === message.user_id) || null
      }));

      setMessages(prev => [...batchWithProfiles, ...prev]);
      setOldestCreatedAt(batchWithProfiles[0]?.created_at || oldestCreatedAt);
      setHasMore((olderData?.length || 0) === PAGE_SIZE);
    } catch (err) {
      console.error('Error loading older messages:', err);
    } finally {
      setLoadingOlder(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user?.id) return;

    console.log("Attempting to send message:", { 
      huddle_id: id, 
      user_id: user.id, 
      content: newMessage.trim() 
    });

    try {
      const { error } = await supabase
        .from("huddle_messages")
        .insert({
          huddle_id: id,
          user_id: user.id,
          content: newMessage.trim()
        });

      if (error) {
        console.error("Insert error:", error);
        throw error;
      }
      
      setNewMessage("");
      console.log("Message sent successfully");
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

  const fetchPollVotes = async (messageId: string) => {
    try {
      const { data: votes, error } = await supabase
        .from('poll_votes')
        .select('*')
        .eq('post_id', messageId);

      if (error) throw error;
      
      setPollVotes(prev => ({ ...prev, [messageId]: votes || [] }));
      
      // Check if current user has voted
      if (user) {
        const userVoteRecord = votes?.find(v => v.user_id === user.id);
        setUserVotes(prev => ({ ...prev, [messageId]: userVoteRecord?.option_id || null }));
      }
    } catch (error) {
      console.error('Error fetching poll votes:', error);
    }
  };

  const handlePollVote = async (messageId: string, optionId: number) => {
    if (!user?.id) {
      toast({
        title: "Please sign in",
        description: "You need to be logged in to vote",
        variant: "destructive"
      });
      return;
    }

    try {
      const currentVote = userVotes[messageId];
      
      if (currentVote === optionId) {
        // Remove vote
        const { error } = await supabase
          .from('poll_votes')
          .delete()
          .eq('post_id', messageId)
          .eq('user_id', user.id);

        if (error) throw error;
        setUserVotes(prev => ({ ...prev, [messageId]: null }));
      } else {
        // Add or update vote
        const { error } = await supabase
          .from('poll_votes')
          .upsert({
            post_id: messageId,
            user_id: user.id,
            option_id: optionId
          });

        if (error) throw error;
        setUserVotes(prev => ({ ...prev, [messageId]: optionId }));
      }
      
      // Refresh poll votes
      await fetchPollVotes(messageId);
    } catch (error: any) {
      console.error('Error voting:', error);
      
      // Check if it's a unique constraint violation (already voted)
      const isAlreadyVoted = error?.message?.includes('duplicate') || error?.code === '23505';
      
      toast({
        title: "Error",
        description: isAlreadyVoted ? "You have already voted on this poll" : "Failed to submit vote",
        variant: "destructive"
      });
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
            <HuddleManagement huddleId={huddle.id} ownerId={huddle.owner_id} huddle={huddle} />
          </div>
        </div>
        <div className="mt-3">
          <CollapsibleMemberList huddleId={huddle.id} ownerId={huddle.owner_id} />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <VirtualizedChat
            items={messages}
            loadMoreTop={loadOlderMessages}
            itemContent={(index, message) => {
              const isCurrentUser = message.user_id === user?.id;
              const isTeamAgent = message.is_team_agent_message;
              return (
                <div 
                  key={message.id}
                  className={`flex gap-2 px-4 ${isCurrentUser && !isTeamAgent ? 'flex-row-reverse' : ''}`}
                >
                  {(!isCurrentUser || isTeamAgent) && (
                    <Avatar className="w-7 h-7 flex-shrink-0">
                      {isTeamAgent && huddle?.team.logo_url ? (
                        <AvatarImage src={huddle.team.logo_url} />
                      ) : (
                        <AvatarImage src={message.profiles?.avatar_url} />
                      )}
                      <AvatarFallback className="text-xs">
                        {isTeamAgent ? 
                          (huddle?.team.name.substring(0, 2).toUpperCase() || 'TA') : 
                          (message.profiles?.display_name || message.profiles?.username) ? 
                          (message.profiles.display_name || message.profiles.username)!.substring(0, 2).toUpperCase() : 'U'}
                      </AvatarFallback>
                    </Avatar>
                  )}

                  <div className={`flex flex-col max-w-[80%] ${isCurrentUser && !isTeamAgent ? 'items-end ml-auto' : 'items-start'}`}>
                    <div className={`flex items-center gap-1 mb-1 px-1 ${isCurrentUser && !isTeamAgent ? 'flex-row-reverse' : ''}`}>
                      <span className="chat-metadata font-medium text-muted-foreground">
                        {isTeamAgent ? `${huddle?.team.name} Agent` : 
                          isCurrentUser ? 'You' : 
                          (message.profiles?.display_name || message.profiles?.username || 'Anonymous')}
                      </span>
                      {isTeamAgent && huddle?.team.sponsor && (
                        <span className="text-xs text-muted-foreground font-light">
                          sponsored by: {huddle.team.sponsor}
                        </span>
                      )}
                    </div>

                    <div className={`
                      px-4 py-2 rounded-2xl max-w-full break-words chat-bubble-shadow
                      ${isCurrentUser && !isTeamAgent 
                        ? 'bg-primary text-primary-foreground rounded-br-md' 
                        : isTeamAgent 
                          ? 'bg-accent text-accent-foreground border border-accent/30 rounded-bl-md'
                          : 'bg-muted text-foreground rounded-bl-md'
                      }
                    `}>
                      <p className="chat-message-text leading-relaxed whitespace-pre-wrap">{message.content}</p>

                      {message.embed_code && (
                        <div className="mt-2">
                          <LazyEmbed>
                            <TwitterEmbed embedCode={message.embed_code} />
                          </LazyEmbed>
                        </div>
                      )}

                      {message.media_url && message.media_type && (
                        <div className="mt-2 max-w-xs">
                          <MediaViewer
                            mediaUrl={message.media_url}
                            mediaType={message.media_type as 'image' | 'video'}
                            className="w-full h-auto rounded-lg"
                          />
                        </div>
                      )}

                      {message.poll_data && (
                        <div className="mt-3 space-y-2">
                          <div className="space-y-2">
                            {message.poll_data.options?.map((option: any) => {
                              const optionVotes = pollVotes[message.id]?.filter(v => v.option_id === option.id).length || 0;
                              const totalVotes = pollVotes[message.id]?.length || 0;
                              const percentage = totalVotes > 0 ? (optionVotes / totalVotes) * 100 : 0;
                              const isSelected = userVotes[message.id] === option.id;

                              return (
                                <Button
                                  key={option.id}
                                  variant={isSelected ? "default" : "secondary"}
                                  className={`w-full justify-between h-auto p-3 relative overflow-hidden ${
                                    isSelected ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-foreground hover:bg-accent hover:text-accent-foreground'
                                  }`}
                                  onClick={() => handlePollVote(message.id, option.id)}
                                >
                                  <div 
                                    className="absolute inset-0 bg-primary/10 transition-all"
                                    style={{ width: `${percentage}%` }}
                                  />
                                  <span className="relative z-10 font-medium">{option.text}</span>
                                  <span className="relative z-10 text-sm opacity-75">
                                    {optionVotes} ({Math.round(percentage)}%)
                                  </span>
                                </Button>
                              );
                            })}
                            <p className="text-xs text-muted-foreground text-center">
                              {pollVotes[message.id]?.length || 0} total votes
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

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

                    <div className="flex gap-1 mt-1 group">
                      {message.user_id === user?.id && !message.is_team_agent_message && (
                        <MakePublicButton
                          messageId={message.id}
                          messageContent={message.content}
                          mediaUrl={message.media_url}
                          mediaType={message.media_type}
                          embedCode={message.embed_code}
                          teamId={huddle?.team.id}
                          isOwner={true}
                        />
                      )}

                      {message.user_id !== user?.id && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
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
                      )}
                    </div>
                  </div>

                  {isCurrentUser && !isTeamAgent && <div className="w-7" />}
                </div>
              );
            }}
          />
        )}
      </div>

      {/* Message Input */}
      <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border">
        <div className="p-3 safe-area-inset-bottom">
          <div className="chat-input-container">
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="text-input w-full min-h-[40px] max-h-[80px] resize-none border-border focus:border-primary bg-background text-foreground placeholder:text-muted-foreground"
              style={{ fontSize: '16px' }}
              onFocus={(e) => {
                e.target.style.setProperty('width', 'calc(100% - 50px)', 'important');
                e.target.style.setProperty('max-width', 'calc(100% - 50px)', 'important');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(e);
                }
              }}
            />
            <div className="flex gap-1 flex-shrink-0 items-end">
              <Dialog open={mediaDialogOpen} onOpenChange={setMediaDialogOpen}>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline" size="icon" className="w-9 h-9 flex-shrink-0">
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
              <Button 
                type="button" 
                disabled={!newMessage.trim()} 
                className="arrow-button w-9 h-9 flex-shrink-0"
                onClick={sendMessage}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <form onSubmit={sendMessage} style={{ display: 'none' }}>
            {/* Hidden form for submit handling */}
          </form>
        </div>
      </div>
    </div>
  );
};