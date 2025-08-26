import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { InviteButton } from "@/components/InviteButton";
import { CollapsibleMemberList } from "@/components/CollapsibleMemberList";
import { MakePublicButton } from "@/components/MakePublicButton";
import { HuddleManagement } from "@/components/HuddleManagement";
import { VirtualizedChat } from "@/components/chat/VirtualizedChat";
import { ChatInput } from "@/components/chat/ChatInput";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { formatDistanceToNow } from "date-fns";

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
  const [loading, setLoading] = useState(true);
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
    const fetchHuddleAndMessages = async () => {
      if (!id) return;
      
      await fetchHuddle();
      await fetchMessages();
      
      // Mark messages as read after initial load
      markMessagesAsRead();
    };

    fetchHuddleAndMessages();
  }, [id]);

  // Mark messages as read when viewing the page
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        markMessagesAsRead();
      }
    };

    const handleFocus = () => {
      markMessagesAsRead();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    // Mark as read immediately when component mounts
    if (id && user?.id) {
      markMessagesAsRead();
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [id, user?.id]);

  // Also mark as read when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      markMessagesAsRead();
    }
  }, [messages.length]);

  // Set up real-time subscription for new messages
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`huddle-messages-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'huddle_messages',
          filter: `huddle_id=eq.${id}`,
        },
        async (payload) => {
          console.log('New message received:', payload);
          
          const newMessage = payload.new as any;
          
          // Fetch profile data for the sender
          if (newMessage.user_id) {
            const { data: profile } = await supabase
              .rpc('get_public_profile', { target_user_id: newMessage.user_id });

            newMessage.profiles = Array.isArray(profile) ? profile[0] : (profile ?? null);
          }
          
          // Fetch reactions
          const reactions = await fetchMessageReactions(newMessage.id);
          newMessage.reactions = reactions;
          
          // Add to messages (avoid duplicates)
          setMessages(prev => (prev.some(m => m.id === newMessage.id) ? prev : [...prev, newMessage]));

          // Auto-scroll to bottom
          setTimeout(scrollToBottom, 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const addNewMessage = async (newMessageData: any) => {
    // Fetch profile for the new message if not already available
    const { data: profileData } = await supabase.rpc('get_public_profile', { 
      target_user_id: newMessageData.user_id 
    });

    const messageWithProfile = {
      ...newMessageData,
      profiles: profileData?.[0] || null
    };

    setMessages(prev => (prev.some(m => m.id === newMessageData.id) ? prev : [...prev, messageWithProfile]));
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

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || !user?.id) return;

    console.log("Attempting to send message:", { 
      huddle_id: id, 
      user_id: user.id, 
      content: messageText.trim() 
    });

    try {
      // Fetch current user profile to ensure latest data
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      // Optimistically add the message with current profile data
      const tempMessage = {
        id: `temp-${Date.now()}`,
        content: messageText.trim(),
        user_id: user.id,
        huddle_id: id,
        created_at: new Date().toISOString(),
        profiles: currentProfile || {
          display_name: user.email?.split('@')[0] || 'User',
          username: null,
          avatar_url: null
        },
        reactions: {},
        media_url: null,
        media_type: 'text',
        embed_code: null,
        is_team_agent_message: false,
        poll_data: null
      };

      setMessages(prev => [...prev, tempMessage]);
      setTimeout(scrollToBottom, 50);

      const { data: inserted, error } = await supabase
        .from("huddle_messages")
        .insert({
          huddle_id: id,
          user_id: user.id,
          content: messageText.trim()
        })
        .select()
        .single();

      if (error) {
        console.error("Insert error:", error);
        // Remove the optimistic message on error
        setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
        throw error;
      }
      
      // Remove temp message, real-time will handle the actual message
      setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
      console.log("Message sent successfully");
      
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      });
    }
  };

  const sendMediaMessage = async (mediaUrl: string, mediaType?: string) => {
    if (!user?.id) return;

    try {
      const { data: inserted, error } = await supabase
        .from("huddle_messages")
        .insert({
          huddle_id: id,
          user_id: user.id,
          content: '',
          media_url: mediaUrl,
          media_type: mediaType || 'image'
        })
        .select()
        .single();

      if (error) throw error;
      
      toast({
        title: "Success",
        description: `${mediaType === 'video' ? 'Video' : 'Image'} sent successfully`,
      });
      
      if (inserted) {
        await addNewMessage(inserted);
      }
      
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

      return reactionCounts;
    } catch (error) {
      console.error("Error fetching reactions:", error);
      return {};
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

      <div className="flex-1 w-full flex flex-col min-h-0">
        {/* Messages Area */}
        <VirtualizedChat
          items={messages}
          loadMoreTop={loadOlderMessages}
          itemContent={(index, message) => {
            const previousMessage = index > 0 ? messages[index - 1] : null;
            const isConsecutive = previousMessage && 
              previousMessage.user_id === message.user_id &&
              new Date(message.created_at).getTime() - new Date(previousMessage.created_at).getTime() < 300000; // 5 minutes
            
            return (
              <MessageBubble
                key={message.id}
                message={message}
                previousMessage={previousMessage}
                isConsecutive={isConsecutive}
                onAddReaction={addReaction}
                currentUserId={user?.id}
                teamName={huddle.team?.name}
                teamLogoUrl={huddle.team?.logo_url}
                teamId={huddle.team?.id}
              />
            );
          }}
        />

        {/* Message Input */}
        <ChatInput
          onSendMessage={sendMessage}
          onSendMedia={sendMediaMessage}
          placeholder="Type your message..."
          disabled={loading}
        />
      </div>
    </div>
  );
};