import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  Menu, 
  Mic, 
  Play, 
  Trophy, 
  Users,
  MessageSquare,
  Star,
  TrendingUp
} from 'lucide-react';

interface User {
  id: string;
  name: string;
  avatar?: string;
  jerseyNumber: string;
  picksCorrect: number;
  totalPicks: number;
}

interface BillsHuddleLayoutProps {
  children: React.ReactNode;
}

const mockUsers: User[] = [
  { id: '1', name: 'Chris', jerseyNumber: '#3', picksCorrect: 4, totalPicks: 6, avatar: '/lovable-uploads/4520766b-9c2a-467d-a68c-44031ab9f4ba.png' },
  { id: '2', name: 'Sarah', jerseyNumber: '#17', picksCorrect: 5, totalPicks: 6 },
  { id: '3', name: 'Mike', jerseyNumber: '#25', picksCorrect: 3, totalPicks: 6 },
  { id: '4', name: 'Kelly', jerseyNumber: '#12', picksCorrect: 2, totalPicks: 5 },
  { id: '5', name: 'Tyler', jerseyNumber: '#1', picksCorrect: 4, totalPicks: 5 },
];

const highlights = [
  { title: 'Allen TD Reel', timeAgo: '2min ago', thumbnail: '/lovable-uploads/89d98004-873f-423c-983e-8f49264b77cf.png' },
  { title: 'Bills Defense Hold', timeAgo: '5min ago', thumbnail: '/lovable-uploads/89d98004-873f-423c-983e-8f49264b77cf.png' },
  { title: 'Mafia Moment', timeAgo: '8min ago', thumbnail: '/lovable-uploads/89d98004-873f-423c-983e-8f49264b77cf.png' }
];

const LeftSidebar = () => (
  <div className="w-64 bg-background border-r border-border flex flex-col h-full">
    {/* Header */}
    <div className="p-4 border-b border-border">
      <div className="flex items-center space-x-3 mb-3">
        <img src="/src/assets/sh-logo-updated.png" alt="SH" className="w-8 h-8" />
        <span className="font-bold text-primary text-xl" style={{ fontFamily: 'Impact, Arial Black, sans-serif' }}>
          SH
        </span>
      </div>
      <h2 className="text-2xl font-bold text-secondary" style={{ fontFamily: 'Impact, Arial Black, sans-serif' }}>
        Bills Mafia Huddle
      </h2>
    </div>

    {/* User List */}
    <div className="flex-1 p-4 space-y-3">
      {mockUsers.map((user) => (
        <div key={user.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer group">
          <div className="relative">
            <Avatar className="w-10 h-10">
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback className="bg-accent text-accent-foreground">
                {user.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <Badge 
              className="absolute -bottom-1 -right-1 bg-accent text-accent-foreground text-xs px-1 py-0 min-w-0 h-5 flex items-center justify-center"
              style={{ fontSize: '10px' }}
            >
              {user.jerseyNumber}
            </Badge>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
              {user.picksCorrect}/{user.totalPicks} picks right
            </p>
          </div>
        </div>
      ))}
    </div>

    {/* Bot Alert */}
    <div className="p-4 border-t border-border">
      <div className="flex items-center space-x-3 p-2 rounded-lg bg-bot-bubble border border-bot-border">
        <Avatar className="w-8 h-8">
          <AvatarFallback className="bg-secondary text-secondary-foreground">
            <Mic className="w-4 h-4" />
          </AvatarFallback>
        </Avatar>
        <span className="text-sm font-semibold">Bot Alert</span>
      </div>
      <div className="mt-2 text-xs text-center p-2 bg-secondary/10 rounded-lg border">
        <div className="font-mono">Bills 24 - Jets 14 | Q3 8:45</div>
        <div className="text-muted-foreground mt-1">Allen: 220yds</div>
      </div>
    </div>
  </div>
);

const RightSidebar = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
  <div className="w-80 bg-card border-l border-border flex flex-col h-full">
    <div className="p-4 border-b border-border">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-secondary" style={{ fontFamily: 'Impact, Arial Black, sans-serif' }}>
          Bot Highlights
        </h3>
        <Button variant="ghost" size="sm" onClick={onClose} className="md:hidden">
          ×
        </Button>
      </div>
    </div>
    
    {/* Highlights */}
    <div className="flex-1 p-4 space-y-4">
      {highlights.map((highlight, index) => (
        <div key={index} className="bg-muted/30 rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors">
          <div className="flex space-x-3">
            <div className="w-16 h-16 bg-secondary/20 rounded-lg flex items-center justify-center relative">
              <Play className="w-6 h-6 text-secondary" />
              <img src={highlight.thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover rounded-lg opacity-30" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-sm">{highlight.title}</h4>
              <p className="text-xs text-muted-foreground">{highlight.timeAgo}</p>
            </div>
          </div>
        </div>
      ))}
    </div>

    {/* Leaderboard */}
    <div className="p-4 border-t border-border">
      <h4 className="text-lg font-bold mb-3 flex items-center space-x-2">
        <Trophy className="w-4 h-4 text-primary" />
        <span>Huddle Heat</span>
      </h4>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>You</span>
          <span className="font-mono">3/5</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Chris</span>
          <span className="font-mono font-bold text-secondary">4/6</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Sarah</span>
          <span className="font-mono">5/6</span>
        </div>
      </div>
    </div>
  </div>
);

const FloatingActionButton = ({ onClick }: { onClick: () => void }) => (
  <Button
    onClick={onClick}
    className="fixed bottom-20 right-4 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all md:hidden"
  >
    <Star className="w-6 h-6" />
  </Button>
);

export const BillsHuddleLayout: React.FC<BillsHuddleLayoutProps> = ({ children }) => {
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false);

  return (
    <div className="h-screen flex bg-background text-foreground">
      {/* Mobile Left Sidebar */}
      <Sheet open={leftSidebarOpen} onOpenChange={setLeftSidebarOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="sm" className="fixed top-4 left-4 z-50 md:hidden">
            <Menu className="w-5 h-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64">
          <LeftSidebar />
        </SheetContent>
      </Sheet>

      {/* Desktop Left Sidebar */}
      <div className="hidden md:block">
        <LeftSidebar />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative">
        {/* Subtle turf texture background */}
        <div 
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(34, 197, 94, 0.3) 1px, transparent 0)',
            backgroundSize: '20px 20px'
          }}
        />
        
        {/* Chat content */}
        <div className="relative z-10 flex-1 flex flex-col">
          {children}
        </div>
      </div>

      {/* Mobile Right Sidebar Sheet */}
      <Sheet open={rightSidebarOpen} onOpenChange={setRightSidebarOpen}>
        <SheetContent side="right" className="p-0 w-80">
          <RightSidebar isOpen={rightSidebarOpen} onClose={() => setRightSidebarOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Desktop Right Sidebar */}
      <div className="hidden lg:block">
        <RightSidebar isOpen={true} onClose={() => {}} />
      </div>

      {/* Floating Action Button */}
      <FloatingActionButton onClick={() => setRightSidebarOpen(true)} />
    </div>
  );
};