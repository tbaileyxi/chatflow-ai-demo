import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

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
  profiles: {
    display_name?: string;
    avatar_url?: string;
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

  useEffect(() => {
    if (id) {
      fetchHuddle();
      fetchMessages();
      
      // Set up real-time subscription for messages
      const channel = supabase
        .channel('huddle-messages')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'huddle_messages',
            filter: `huddle_id=eq.${id}`
          },
          () => {
            fetchMessages(); // Refresh messages when new one is added
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [id]);

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
      const { data, error } = await supabase
        .from("huddle_messages")
        .select(`
          id,
          content,
          created_at,
          user_id,
          profiles!fk_huddle_messages_user_id(display_name, avatar_url)
        `)
        .eq("huddle_id", id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);
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
      fetchMessages(); // Refresh messages
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to send message",
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
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="flex gap-3">
              <Avatar className="w-8 h-8">
                <AvatarImage src={message.profiles?.avatar_url} />
                <AvatarFallback>
                  {message.profiles?.display_name ? message.profiles.display_name.substring(0, 2).toUpperCase() : 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">
                    {message.profiles?.display_name || 'Anonymous'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(message.created_at).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm">{message.content}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Message Input */}
      <Card className="m-4 p-3 border-0 border-t border-border rounded-none">
        <form onSubmit={sendMessage} className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1"
          />
          <Button type="submit" disabled={!newMessage.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </Card>
    </div>
  );
};