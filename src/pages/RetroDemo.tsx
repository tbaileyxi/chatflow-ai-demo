import React, { useState } from 'react';
import { RetroMessageBubble } from '@/components/retro/RetroMessageBubble';
import { RetroHighlightsSidebar } from '@/components/retro/RetroHighlightsSidebar';
import { useRetroTheme } from '@/hooks/useRetroTheme';
import { Button } from '@/components/ui/button';
import { Megaphone, Star } from 'lucide-react';

export const RetroDemo = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const retroTheme = useRetroTheme('Buffalo Bills');

  const mockMessages = [
    {
      id: '1',
      content: 'Bills are crushing it this season! 🔥',
      created_at: new Date().toISOString(),
      user_id: 'user1',
      is_bot_message: false
    },
    {
      id: '2', 
      content: 'TOUCHDOWN! Josh Allen with the perfect pass! 💯',
      created_at: new Date().toISOString(),
      user_id: 'bot',
      is_bot_message: true,
      embed_code: '<blockquote class="twitter-tweet"><p>Amazing play!</p></blockquote>'
    }
  ];

  const mockUser = {
    id: 'user1',
    display_name: 'Bills Fan',
    avatar_url: '',
    username: 'billsfan'
  };

  return (
    <div className="min-h-screen bg-background crt-effect">
      {/* Header */}
      <div className="p-4 border-b border-team-primary/30">
        <h1 className="retro-header text-2xl text-center neon-text">
          {retroTheme.name} - Retro Huddle
        </h1>
        <p className="text-center font-arcade text-sm mt-2 opacity-80">
          Universal SideHuddle Sports Theme Demo
        </p>
      </div>

      {/* Main Content */}
      <div className="flex">
        {/* Central Chat Column */}
        <div className="flex-1 max-w-4xl mx-auto">
          <div className="retro-chat-column my-4">
            {mockMessages.map((message, index) => (
              <RetroMessageBubble
                key={message.id}
                message={message}
                user={mockUser}
                currentUserId="user1"
                isAdmin={true}
                onMegaphone={() => console.log('Megaphone')}
                onHighlight={() => console.log('Highlight')}
                onCopyCallout={() => setSidebarOpen(true)}
              />
            ))}
          </div>
        </div>

        {/* Floating Action Button */}
        <Button
          onClick={() => setSidebarOpen(true)}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full retro-megaphone shadow-lg z-20"
        >
          <Star className="w-6 h-6" />
        </Button>
      </div>

      {/* Highlights Sidebar */}
      <RetroHighlightsSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
    </div>
  );
};