import React, { useState } from 'react';
import { RetroMessageBubble } from '@/components/retro/RetroMessageBubble';
import { RetroHighlightsSidebar } from '@/components/retro/RetroHighlightsSidebar';
import { useRetroTheme } from '@/hooks/useRetroTheme';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star, Users } from 'lucide-react';

export const RetroDemo = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [highlights, setHighlights] = useState<Array<{id: string, content: string}>>([]);
  const retroTheme = useRetroTheme('Colorado Buffaloes');

  const mockMessages = [
    {
      id: '1',
      content: 'Colorado looking strong this season! 🦬🔥',
      created_at: new Date(Date.now() - 5 * 60000).toISOString(),
      user_id: 'user1',
      is_bot_message: false
    },
    {
      id: '2', 
      content: 'HUGE DEFENSIVE STOP! Buffs keeping them scoreless in the red zone! 💪⚡',
      created_at: new Date(Date.now() - 3 * 60000).toISOString(),
      user_id: 'bot',
      is_bot_message: true,
      embed_code: '<div class="bg-gradient-to-r from-yellow-400 to-amber-500 p-4 rounded-lg text-black font-bold">🏈 LIVE: Colorado 14 - Opponent 7 | Q2 5:47</div>'
    },
    {
      id: '3',
      content: 'That tackle was INSANE! Coach Prime building something special here 🔥',
      created_at: new Date(Date.now() - 2 * 60000).toISOString(),
      user_id: 'user2',
      is_bot_message: false
    },
    {
      id: '4',
      content: 'Who else thinks this defense is championship level? 🏆',
      created_at: new Date(Date.now() - 1 * 60000).toISOString(),
      user_id: 'user3',
      is_bot_message: false
    }
  ];

  const mockUsers = {
    'user1': { id: 'user1', display_name: 'BuffsFan21', avatar_url: '', username: 'buffsfan21' },
    'user2': { id: 'user2', display_name: 'Coach_Prime_Fan', avatar_url: '', username: 'coachprimefan' },
    'user3': { id: 'user3', display_name: 'You', avatar_url: '', username: 'you' },
    'bot': { id: 'bot', display_name: 'Game Bot', avatar_url: '', username: 'gamebot' }
  };

  const handleHighlight = (messageId: string, content: string) => {
    setHighlights(prev => [...prev, { id: messageId, content }]);
    setSidebarOpen(true);
  };

  return (
    <div className="min-h-screen bg-background crt-effect flex">
      {/* Left Sidebar - Tighter Avatars */}
      <div className="hidden md:flex flex-col w-16 bg-muted/20 border-r border-team-primary/30 p-2 gap-2">
        <div className="text-center mb-4">
          <div className="text-xs font-pixel text-team-secondary">{retroTheme.mascot}</div>
        </div>
        
        {/* Online Members - Tighter */}
        <div className="space-y-1">
          {Object.values(mockUsers).slice(0, 4).map((user, index) => (
            <div key={user.id} className="relative">
              <Avatar className="h-10 w-10">
                <AvatarImage src={user.avatar_url} alt={user.display_name} />
                <AvatarFallback className="text-xs font-pixel bg-team-primary/20 text-team-primary border border-team-primary/40">
                  {user.display_name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-background"></div>
            </div>
          ))}
        </div>
        
        <div className="mt-auto text-center">
          <div className="text-xs font-arcade text-muted-foreground">4 online</div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-background/95 backdrop-blur border-b border-team-primary/30 p-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="retro-header text-lg neon-text">
                {retroTheme.name} Game Chat
              </h1>
              <p className="font-arcade text-xs text-muted-foreground">
                Live game discussion • 4 members online
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(true)}
              className="md:hidden"
            >
              <Star className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Chat Messages - Scrollable Container */}
        <div className="flex-1 overflow-y-auto p-2">
          <div className="max-w-4xl mx-auto space-y-1">
            {mockMessages.map((message) => (
              <RetroMessageBubble
                key={message.id}
                message={message}
                user={mockUsers[message.user_id as keyof typeof mockUsers]}
                currentUserId="user3"
                isAdmin={true}
                onMegaphone={(messageId) => console.log('Megaphone:', messageId)}
                onHighlight={(messageId) => {
                  const msg = mockMessages.find(m => m.id === messageId);
                  if (msg) handleHighlight(messageId, msg.content);
                }}
                onCopyCallout={(messageId, content) => handleHighlight(messageId, content)}
              />
            ))}
          </div>
        </div>

        {/* Chat Input */}
        <div className="border-t border-team-primary/30 p-3 bg-background/95 backdrop-blur">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Share your thoughts..."
              className="flex-1 bg-muted/30 border border-team-primary/40 rounded-lg px-3 py-2 text-sm font-chat 
                       focus:outline-none focus:ring-2 focus:ring-team-primary/50 
                       placeholder:text-muted-foreground contrast-text"
            />
            <Button size="sm" className="retro-megaphone">
              Send
            </Button>
          </div>
        </div>
      </div>

      {/* Highlights Sidebar - Demo placeholder */}
      {sidebarOpen && (
        <div className="fixed right-0 top-0 bottom-0 w-80 z-30 bg-background border-l border-team-primary/30">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-arcade text-lg">Demo Mode</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(false)}
                className="h-8 w-8 p-0"
              >
                ×
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              This is a demo. Real heat tracking and highlights work in live huddles!
            </p>
          </div>
        </div>
      )}

      {/* Mobile Floating Action Button */}
      <Button
        onClick={() => setSidebarOpen(true)}
        className="md:hidden fixed bottom-6 right-6 h-12 w-12 rounded-full retro-megaphone shadow-lg z-20"
      >
        <Star className="w-5 h-5" />
      </Button>
    </div>
  );
};