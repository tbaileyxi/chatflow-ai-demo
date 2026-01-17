import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Radio, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface LiveEvent {
  id: string;
  name: string;
  subtitle: string | null;
  start_time: string;
  network: string | null;
  status: 'upcoming' | 'live' | 'completed';
  score_team1: number | null;
  score_team2: number | null;
}

interface LiveEventCardProps {
  event: LiveEvent;
}

export const LiveEventCard = ({ event }: LiveEventCardProps) => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/room/${event.id}`);
  };

  return (
    <button
      onClick={handleClick}
      className="w-full bg-gradient-to-r from-destructive/10 via-destructive/5 to-transparent rounded-xl p-4 border-2 border-destructive/30 hover:border-destructive/50 transition-all text-left"
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="destructive" className="animate-pulse text-xs gap-1">
              <Radio className="h-3 w-3" />
              LIVE
            </Badge>
            {event.network && (
              <span className="text-sm text-muted-foreground">{event.network}</span>
            )}
          </div>
          <h3 className="font-bold text-lg">{event.name}</h3>
          {event.subtitle && (
            <p className="text-sm text-muted-foreground">{event.subtitle}</p>
          )}
          {event.score_team1 !== null && event.score_team2 !== null && (
            <p className="text-2xl font-bold text-primary mt-2">
              {event.score_team1} - {event.score_team2}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            Bot updates enabled • Join the live chat
          </p>
        </div>
        <ChevronRight className="h-6 w-6 text-muted-foreground" />
      </div>
    </button>
  );
};
