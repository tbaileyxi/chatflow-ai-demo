import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { GlassHeader } from '@/components/mobile/GlassHeader';
import { ModernChatBubble } from '@/components/mobile/ModernChatBubble';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Send, Paperclip, Users, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

interface Message {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  is_bot_message?: boolean;
  media_url?: string;
  media_type?: string;
  embed_code?: string;
}

interface User {
  id: string;
  display_name: string;
  avatar_url?: string;
}

interface HuddleData {
  id: string;
  name: string;
  team_name: string;
  team_logo_url: string;
  participant_count: number;
  is_verified?: boolean;
}

export const MobileChat = () => {
  const { huddleId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [huddle, setHuddle] = useState<HuddleData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Mock users data
  const users: Record<string, User> = {
    'user1': { id: 'user1', display_name: 'You', avatar_url: undefined },
    'bot1': { id: 'bot1', display_name: 'Lakers Bot', avatar_url: '/lovable-uploads/4520766b-9c2a-467d-a68c-44031ab9f4ba.png' },
    'user2': { id: 'user2', display_name: 'Sarah', avatar_url: undefined },
    'user3': { id: 'user3', display_name: 'Mike', avatar_url: undefined }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Mock data for demo
    const mockHuddle: HuddleData = {
      id: huddleId || '1',
      name: 'Lakers Core',
      team_name: 'Los Angeles Lakers',
      team_logo_url: '/lovable-uploads/4520766b-9c2a-467d-a68c-44031ab9f4ba.png',
      participant_count: 4,
      is_verified: true
    };

    const mockMessages: Message[] = [
      {
        id: '1',
        content: 'Welcome to the Lakers Core huddle! 🏀 I\'ll keep you updated with the latest news, highlights, and game updates.',
        created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        user_id: 'bot1',
        is_bot_message: true
      },
      {
        id: '2',
        content: 'Hey everyone! Ready for tonight\'s game? 💜💛',
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        user_id: 'user2'
      },
      {
        id: '3',
        content: 'Can\'t wait! LeBron has been on fire lately',
        created_at: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
        user_id: 'user3'
      },
      {
        id: '4',
        content: '🚨 INJURY UPDATE: Anthony Davis is probable for tonight\'s game with a minor ankle issue. Should be good to go! 💪',
        created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        user_id: 'bot1',
        is_bot_message: true
      },
      {
        id: '5',
        content: 'That\'s great news! We need AD healthy for the playoffs',
        created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        user_id: 'user1'
      }
    ];

    setTimeout(() => {
      setHuddle(mockHuddle);
      setMessages(mockMessages);
      setLoading(false);
    }, 500);
  }, [huddleId]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    setSending(true);
    const messageText = newMessage.trim();
    setNewMessage('');

    // Add user message immediately
    const userMessage: Message = {
      id: Date.now().toString(),
      content: messageText,
      created_at: new Date().toISOString(),
      user_id: 'user1'
    };

    setMessages(prev => [...prev, userMessage]);

    // Simulate bot response after user message
    setTimeout(() => {
      if (messageText.toLowerCase().includes('score') || messageText.toLowerCase().includes('game')) {
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: '🏀 Current score: Lakers 85 - Celtics 82 (3rd Quarter, 4:23 remaining). LeBron leading with 24 points!',
          created_at: new Date().toISOString(),
          user_id: 'bot1',
          is_bot_message: true
        };
        setMessages(prev => [...prev, botMessage]);
      }
      setSending(false);
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (loading) {
    return (
      <MobileLayout hasBottomNav={false}>
        <GlassHeader title="Loading..." />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading chat...</div>
        </div>
      </MobileLayout>
    );
  }

  if (!huddle) {
    return (
      <MobileLayout hasBottomNav={false}>
        <GlassHeader title="Huddle not found" />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">This huddle could not be found.</p>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout hasBottomNav={false}>
      <GlassHeader
        title={huddle.name}
        subtitle={`${huddle.team_name} • ${huddle.participant_count} members`}
        teamLogo={huddle.team_logo_url}
        rightAction={
          <div className="flex items-center gap-2">
            {huddle.is_verified && (
              <Badge variant="secondary" className="text-xs bg-verified-background text-verified-primary border-verified-border">
                Verified
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="p-2 hover:bg-white/10 rounded-full"
              onClick={() => navigate(`/huddle/${huddle.id}/settings`)}
            >
              <Settings className="h-5 w-5 text-foreground" />
            </Button>
          </div>
        }
      />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="pb-4">
          {messages.map((message, index) => {
            const previousMessage = index > 0 ? messages[index - 1] : null;
            const isConsecutive = previousMessage && 
              previousMessage.user_id === message.user_id &&
              new Date(message.created_at).getTime() - new Date(previousMessage.created_at).getTime() < 2 * 60 * 1000;

            return (
              <ModernChatBubble
                key={message.id}
                message={message}
                user={users[message.user_id]}
                currentUserId="user1"
                teamName={huddle.team_name}
                teamLogoUrl={huddle.team_logo_url}
                isConsecutive={isConsecutive}
                previousMessage={previousMessage}
              />
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Chat input */}
      <div className="glass-header border-t border-white/10 p-4">
        <div className="flex items-end gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="p-2 hover:bg-white/10 rounded-full shrink-0"
          >
            <Paperclip className="h-5 w-5 text-muted-foreground" />
          </Button>
          
          <div className="flex-1 relative">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="pr-12 rounded-full bg-muted/20 border-white/10 text-foreground placeholder:text-muted-foreground"
              disabled={sending}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || sending}
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 rounded-full bg-primary hover:bg-primary/90 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </MobileLayout>
  );
};