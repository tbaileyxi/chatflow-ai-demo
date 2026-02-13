import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Users } from 'lucide-react';

interface TeamTileProps {
  team: {
    id: string;
    name: string;
    city: string;
    logo_url?: string;
    league?: string;
  };
  huddle?: {
    id: string;
    member_count: number;
    last_message_at?: string;
  };
  size?: 'default' | 'large';
}

export const TeamTile: React.FC<TeamTileProps> = ({ team, huddle, size = 'default' }) => {
  const navigate = useNavigate();
  
  const isActive = huddle?.last_message_at 
    ? new Date(huddle.last_message_at) > new Date(Date.now() - 30 * 60 * 1000) // Active within last 30 min
    : false;

  const handleClick = () => {
    if (huddle?.id) {
      navigate(`/huddle/${huddle.id}`);
    } else {
      // Navigate to team feed for teams without huddles
      navigate(`/teams/${team.id}`);
    }
  };

  const sizeClasses = size === 'large' 
    ? 'p-4 min-h-[140px]' 
    : 'p-3 min-h-[110px]';
  
  const avatarSize = size === 'large' ? 'w-16 h-16' : 'w-12 h-12';

  return (
    <div
      onClick={handleClick}
      className={cn(
        "relative bg-card border border-border rounded-xl cursor-pointer",
        "hover:border-primary/50 hover:shadow-lg transition-all duration-200",
        "flex flex-col items-center justify-center gap-2",
        "overflow-hidden group",
        sizeClasses
      )}
    >
      {/* Active indicator */}
      {isActive && (
        <div className="absolute top-2 right-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        </div>
      )}

      <Avatar className={avatarSize}>
        <AvatarImage src={team.logo_url} alt={team.name} />
        <AvatarFallback className="bg-primary/10 text-primary font-bold">
          {team.city.substring(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="text-center w-full px-2 overflow-hidden">
        <p className="text-xs text-muted-foreground truncate">
          {team.city}
        </p>
        <p className="font-bold text-sm text-foreground truncate">
          {team.name}
        </p>
        {huddle && (
          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mt-1">
            <Users className="w-3 h-3" />
            <span>{huddle.member_count || 0}</span>
          </div>
        )}
        {isActive && (
          <p className="text-xs text-green-600 dark:text-green-400 mt-1 font-semibold">
            Live now
          </p>
        )}
      </div>
    </div>
  );
};
