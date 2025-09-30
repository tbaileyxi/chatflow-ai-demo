import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Star, TrendingUp, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Highlight {
  id: string;
  title: string;
  type: 'video' | 'poll' | 'stat';
  timestamp: string;
  thumbnail?: string;
  engagement: number;
}

interface RetroHighlightsSidebarProps {
  highlights: any[];
  onClose: () => void;
  teamName?: string;
  leaderboard?: Array<{ name: string; score: number; rank: number }>;
  className?: string;
}

export const RetroHighlightsSidebar: React.FC<RetroHighlightsSidebarProps> = ({
  highlights = [],
  onClose,
  teamName,
  leaderboard = [],
  className
}) => {
  const [activeTab, setActiveTab] = useState<'highlights' | 'leaderboard'>('highlights');

  // Mock data if none provided
  const mockHighlights: Highlight[] = highlights.length > 0 ? highlights : [
    { id: '1', title: 'Epic TD Run!', type: 'video', timestamp: '2min ago', engagement: 127 },
    { id: '2', title: 'Defense Poll', type: 'poll', timestamp: '5min ago', engagement: 89 },
    { id: '3', title: 'Live Stats Update', type: 'stat', timestamp: '8min ago', engagement: 203 }
  ];

  const mockLeaderboard = leaderboard.length > 0 ? leaderboard : [
    { name: 'You', score: 3, rank: 1 },
    { name: 'Chris #3', score: 4, rank: 2 },
    { name: 'Sarah', score: 2, rank: 3 }
  ];

  return (
    <div className={cn(
      "flex flex-col h-full bg-background/95 backdrop-blur-sm",
      className
    )}>
      <div className="flex flex-col h-full p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="retro-header text-lg">Bot's Blitz Board</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 hover:bg-muted/50"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            <Button
              variant={activeTab === 'highlights' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('highlights')}
              className="flex-1 font-arcade text-xs"
            >
              <Star className="w-3 h-3 mr-1" />
              Highlights
            </Button>
            <Button
              variant={activeTab === 'leaderboard' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('leaderboard')}
              className="flex-1 font-arcade text-xs"
            >
              <TrendingUp className="w-3 h-3 mr-1" />
              Heat
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'highlights' ? (
              <div className="space-y-3">
                {mockHighlights.map((highlight) => (
                  <div
                    key={highlight.id}
                    className="retro-embed p-3 cursor-pointer group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                        {highlight.type === 'video' && '🎬'}
                        {highlight.type === 'poll' && '📊'}
                        {highlight.type === 'stat' && '📈'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-chat font-medium text-sm truncate">
                          {highlight.title}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {highlight.timestamp}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {highlight.engagement} 🔥
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <h3 className="font-arcade text-sm text-center neon-text">Huddle Heat</h3>
                {mockLeaderboard.map((player) => (
                  <div
                    key={player.name}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-team-primary/20 flex items-center justify-center text-xs font-pixel">
                        {player.rank}
                      </span>
                      <span className="font-chat text-sm">{player.name}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {player.score}/5 ⚡
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
      </div>
    </div>
  );
};