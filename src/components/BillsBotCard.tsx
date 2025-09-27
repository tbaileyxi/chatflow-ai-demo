import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  ThumbsUp, 
  MessageSquare, 
  TrendingUp,
  Zap,
  Trophy
} from 'lucide-react';

interface BillsBotCardProps {
  type: 'highlight' | 'stat' | 'poll' | 'score';
  title: string;
  content: string;
  metadata?: {
    reactions?: number;
    thumbnail?: string;
    stats?: { label: string; value: string }[];
    poll?: { question: string; options: string[] };
  };
  className?: string;
}

export const BillsBotCard: React.FC<BillsBotCardProps> = ({ 
  type, 
  title, 
  content, 
  metadata = {},
  className = '' 
}) => {
  const getCardIcon = () => {
    switch (type) {
      case 'highlight': return <Zap className="w-5 h-5" />;
      case 'stat': return <TrendingUp className="w-5 h-5" />;
      case 'poll': return <MessageSquare className="w-5 h-5" />;
      case 'score': return <Trophy className="w-5 h-5" />;
      default: return <Zap className="w-5 h-5" />;
    }
  };

  const getCardTitle = () => {
    switch (type) {
      case 'highlight': return 'Mafia Highlight!';
      case 'stat': return 'Live Stat Alert';
      case 'poll': return 'Huddle Poll';
      case 'score': return 'Game Update';
      default: return 'Bills Update';
    }
  };

  return (
    <Card className={`bg-bot-bubble border border-bot-border shadow-lg ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-secondary rounded-full text-secondary-foreground">
            {getCardIcon()}
          </div>
          <h3 
            className="text-lg font-bold text-secondary" 
            style={{ fontFamily: 'Impact, Arial Black, sans-serif' }}
          >
            {getCardTitle()}
          </h3>
          {metadata.reactions && (
            <Badge className="ml-auto bg-secondary/20 text-secondary">
              {metadata.reactions} 🔥
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Main Content */}
        <div>
          <h4 className="font-semibold text-foreground mb-2">{title}</h4>
          <p className="text-sm text-muted-foreground">{content}</p>
        </div>

        {/* Highlight specific content */}
        {type === 'highlight' && metadata.thumbnail && (
          <div className="relative bg-muted/20 rounded-lg overflow-hidden aspect-video">
            <img 
              src={metadata.thumbnail} 
              alt="Highlight" 
              className="w-full h-full object-cover opacity-60"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <Button size="sm" className="bg-secondary hover:bg-secondary/90 text-secondary-foreground rounded-full w-12 h-12">
                <Play className="w-5 h-5 ml-0.5" />
              </Button>
            </div>
            <div className="absolute bottom-2 left-2">
              <Badge className="bg-black/70 text-white text-xs">
                Full replay from @Bills
              </Badge>
            </div>
          </div>
        )}

        {/* Stats display */}
        {type === 'stat' && metadata.stats && (
          <div className="grid grid-cols-2 gap-3">
            {metadata.stats.map((stat, index) => (
              <div key={index} className="bg-muted/30 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-secondary font-mono">
                  {stat.value}
                </div>
                <div className="text-xs text-muted-foreground">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Poll options */}
        {type === 'poll' && metadata.poll && (
          <div className="space-y-2">
            <p className="text-sm font-medium">{metadata.poll.question}</p>
            <div className="space-y-2">
              {metadata.poll.options.map((option, index) => (
                <Button 
                  key={index}
                  variant="outline" 
                  className="w-full justify-start text-sm h-auto py-2 px-3"
                >
                  <span className="mr-2">
                    {String.fromCharCode(65 + index)}:
                  </span>
                  {option}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            <ThumbsUp className="w-4 h-4 mr-1" />
            React
          </Button>
          
          {type === 'highlight' && (
            <Button size="sm" className="bg-secondary hover:bg-secondary/90 text-secondary-foreground">
              View Full Replay
            </Button>
          )}
          
          {type === 'poll' && (
            <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground">
              Vote Now
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};