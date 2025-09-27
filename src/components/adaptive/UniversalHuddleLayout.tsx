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
  TrendingUp,
  Zap
} from 'lucide-react';
import { useTeamTheme } from '@/hooks/useTeamTheme';

interface User {
  id: string;
  name: string;
  avatar?: string;
  jerseyNumber: string;
  picksCorrect: number;
  totalPicks: number;
}

interface UniversalHuddleLayoutProps {
  children: React.ReactNode;
  teamName?: string;
  huddle?: any;
}

const mockUsers: User[] = [
  { id: '1', name: 'Chris', jerseyNumber: '#3', picksCorrect: 4, totalPicks: 6, avatar: '/lovable-uploads/4520766b-9c2a-467d-a68c-44031ab9f4ba.png' },
  { id: '2', name: 'Sarah', jerseyNumber: '#17', picksCorrect: 5, totalPicks: 6 },
  { id: '3', name: 'Mike', jerseyNumber: '#25', picksCorrect: 3, totalPicks: 6 },
  { id: '4', name: 'Kelly', jerseyNumber: '#12', picksCorrect: 2, totalPicks: 5 },
  { id: '5', name: 'Tyler', jerseyNumber: '#1', picksCorrect: 4, totalPicks: 5 },
];

const highlights = [
  { title: 'Epic TD Reel', timeAgo: '2min ago', thumbnail: '/lovable-uploads/89d98004-873f-423c-983e-8f49264b77cf.png' },
  { title: 'Defense Dominance', timeAgo: '5min ago', thumbnail: '/lovable-uploads/89d98004-873f-423c-983e-8f49264b77cf.png' },
  { title: 'Fan Frenzy', timeAgo: '8min ago', thumbnail: '/lovable-uploads/89d98004-873f-423c-983e-8f49264b77cf.png' }
];

const LeftSidebar = ({ theme }: { theme: ReturnType<typeof useTeamTheme> }) => (
  <div className="w-64 bg-background border-r border-border flex flex-col h-full">
    {/* Header with Formation Animation */}
    <div className="p-4 border-b border-border">
      <div className="flex items-center space-x-3 mb-3 animate-fade-in">
        <img src="/src/assets/sh-logo-updated.png" alt="SH" className="w-8 h-8 hover-scale" />
        <span className="font-bold text-primary text-xl transition-all duration-300" 
              style={{ fontFamily: 'Impact, Arial Black, sans-serif', color: `hsl(${theme.accent})` }}>
          SH
        </span>
      </div>
      <h2 className="text-2xl font-bold transition-all duration-500 hover:scale-105" 
          style={{ 
            fontFamily: 'Impact, Arial Black, sans-serif',
            color: `hsl(${theme.primary})`
          }}>
        {theme.name} {theme.mascot}
      </h2>
    </div>

    {/* User List with Formation Animations */}
    <div className="flex-1 p-4 space-y-3">
      {mockUsers.map((user, index) => (
        <div 
          key={user.id} 
          className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer group transition-all duration-300 hover:scale-105 animate-slide-in-right"
          style={{ 
            animationDelay: `${index * 100}ms`,
            animationFillMode: 'both'
          }}
        >
          <div className="relative">
            <Avatar className="w-10 h-10 transition-transform duration-300 group-hover:scale-110">
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback className="bg-accent text-accent-foreground">
                {user.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <Badge 
              className="absolute -bottom-1 -right-1 text-xs px-1 py-0 min-w-0 h-5 flex items-center justify-center transition-colors duration-300"
              style={{ 
                backgroundColor: `hsl(${theme.secondary})`,
                color: `hsl(${theme.accent})`,
                fontSize: '10px' 
              }}
            >
              {user.jerseyNumber}
            </Badge>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              {user.picksCorrect}/{user.totalPicks} picks right
            </p>
          </div>
        </div>
      ))}
    </div>

    {/* Bot Alert with Pulse Animation */}
    <div className="p-4 border-t border-border">
      <div 
        className="flex items-center space-x-3 p-2 rounded-lg border transition-all duration-300 hover:scale-105 animate-pulse"
        style={{
          backgroundColor: `hsl(${theme.primary} / 0.15)`,
          borderColor: `hsl(${theme.primary} / 0.3)`
        }}
      >
        <Avatar className="w-8 h-8">
          <AvatarFallback style={{ backgroundColor: `hsl(${theme.secondary})` }}>
            <Mic className="w-4 h-4" style={{ color: `hsl(${theme.accent})` }} />
          </AvatarFallback>
        </Avatar>
        <span className="text-sm font-semibold">Bot Alert {theme.mascot}</span>
      </div>
      <div 
        className="mt-2 text-xs text-center p-2 rounded-lg border animate-fade-in"
        style={{
          backgroundColor: `hsl(${theme.secondary} / 0.1)`,
          borderColor: `hsl(${theme.secondary} / 0.2)`
        }}
      >
        <div className="font-mono">Live Score Update | Q3 8:45</div>
        <div className="text-muted-foreground mt-1">Stats: 220yds</div>
      </div>
    </div>
  </div>
);

const RightSidebar = ({ 
  theme, 
  isOpen, 
  onClose 
}: { 
  theme: ReturnType<typeof useTeamTheme>;
  isOpen: boolean; 
  onClose: () => void;
}) => (
  <div className="w-80 bg-card border-l border-border flex flex-col h-full">
    <div className="p-4 border-b border-border">
      <div className="flex items-center justify-between">
        <h3 
          className="text-xl font-bold transition-all duration-300 hover:scale-105" 
          style={{ 
            fontFamily: 'Impact, Arial Black, sans-serif',
            color: `hsl(${theme.primary})`
          }}
        >
          Bot's Blitz Board {theme.mascot}
        </h3>
        <Button variant="ghost" size="sm" onClick={onClose} className="md:hidden">
          ×
        </Button>
      </div>
    </div>
    
    {/* Huddle Holograms */}
    <div className="flex-1 p-4 space-y-4">
      {highlights.map((highlight, index) => (
        <div 
          key={index} 
          className="rounded-lg p-3 cursor-pointer transition-all duration-300 hover:scale-105 hover:rotate-1 animate-fade-in"
          style={{ 
            backgroundColor: 'hsl(var(--muted) / 0.3)',
            animationDelay: `${index * 150}ms`,
            animationFillMode: 'both'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05) rotateX(5deg) rotateY(5deg)';
            e.currentTarget.style.boxShadow = `0 10px 30px hsl(${theme.primary} / 0.3)`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1) rotateX(0deg) rotateY(0deg)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div className="flex space-x-3">
            <div 
              className="w-16 h-16 rounded-lg flex items-center justify-center relative transition-all duration-300"
              style={{ backgroundColor: `hsl(${theme.secondary} / 0.2)` }}
            >
              <Play 
                className="w-6 h-6 z-10" 
                style={{ color: `hsl(${theme.secondary})` }} 
              />
              <img 
                src={highlight.thumbnail} 
                alt="" 
                className="absolute inset-0 w-full h-full object-cover rounded-lg opacity-30" 
              />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-sm">{highlight.title}</h4>
              <p className="text-xs text-muted-foreground">{highlight.timeAgo}</p>
            </div>
          </div>
        </div>
      ))}
    </div>

    {/* Enhanced Leaderboard */}
    <div className="p-4 border-t border-border">
      <h4 className="text-lg font-bold mb-3 flex items-center space-x-2 animate-fade-in">
        <Trophy className="w-4 h-4" style={{ color: `hsl(${theme.primary})` }} />
        <span>Huddle Heat</span>
      </h4>
      <div className="space-y-2">
        <div className="flex justify-between text-sm items-center">
          <span>You</span>
          <div className="flex items-center space-x-2">
            <div 
              className="h-2 w-12 rounded-full"
              style={{ backgroundColor: `hsl(${theme.accent} / 0.3)` }}
            >
              <div 
                className="h-full rounded-full transition-all duration-500"
                style={{ 
                  width: '60%',
                  backgroundColor: `hsl(${theme.accent})`
                }}
              />
            </div>
            <span className="font-mono">3/5</span>
          </div>
        </div>
        <div className="flex justify-between text-sm items-center">
          <span>Chris</span>
          <div className="flex items-center space-x-2">
            <div 
              className="h-2 w-12 rounded-full"
              style={{ backgroundColor: `hsl(${theme.primary} / 0.3)` }}
            >
              <div 
                className="h-full rounded-full transition-all duration-500"
                style={{ 
                  width: '67%',
                  backgroundColor: `hsl(${theme.primary})`
                }}
              />
            </div>
            <span className="font-mono font-bold" style={{ color: `hsl(${theme.secondary})` }}>4/6</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const FloatingActionButton = ({ 
  theme, 
  onClick 
}: { 
  theme: ReturnType<typeof useTeamTheme>;
  onClick: () => void;
}) => (
  <Button
    onClick={onClick}
    className="fixed bottom-20 right-4 z-50 w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 animate-bounce md:hidden"
    style={{
      backgroundColor: `hsl(${theme.accent})`,
      color: `hsl(${theme.primary})`
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'scale(1.1)';
      e.currentTarget.style.boxShadow = `0 15px 35px hsl(${theme.accent} / 0.4)`;
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'scale(1)';
      e.currentTarget.style.boxShadow = `0 8px 25px hsl(${theme.accent} / 0.2)`;
    }}
  >
    <Star className="w-6 h-6" />
  </Button>
);

export const UniversalHuddleLayout: React.FC<UniversalHuddleLayoutProps> = ({ 
  children, 
  teamName,
  huddle 
}) => {
  const theme = useTeamTheme(teamName || huddle?.team?.name);
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
          <LeftSidebar theme={theme} />
        </SheetContent>
      </Sheet>

      {/* Desktop Left Sidebar */}
      <div className="hidden md:block">
        <LeftSidebar theme={theme} />
      </div>

      {/* Main Chat Area with Dynamic Texture */}
      <div className="flex-1 flex flex-col relative">
        {/* Dynamic team texture background */}
        <div 
          className="absolute inset-0 opacity-10 pointer-events-none transition-all duration-1000"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, hsl(${theme.primary} / 0.4) 1px, transparent 0)`,
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
          <RightSidebar 
            theme={theme} 
            isOpen={rightSidebarOpen} 
            onClose={() => setRightSidebarOpen(false)} 
          />
        </SheetContent>
      </Sheet>

      {/* Desktop Right Sidebar */}
      <div className="hidden lg:block">
        <RightSidebar theme={theme} isOpen={true} onClose={() => {}} />
      </div>

      {/* Floating Action Button */}
      <FloatingActionButton theme={theme} onClick={() => setRightSidebarOpen(true)} />
    </div>
  );
};