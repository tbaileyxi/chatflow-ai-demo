import React from 'react';
import { Star, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserBadgeIconProps {
  tier: 'basic' | 'superfan';
  teamName?: string;
  teamLogoUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
}

export function UserBadgeIcon({ 
  tier, 
  teamName, 
  teamLogoUrl,
  size = 'sm', 
  className,
  onClick
}: UserBadgeIconProps) {
  const sizeClasses = {
    sm: 'h-5 w-5',
    md: 'h-6 w-6',
    lg: 'h-7 w-7'
  };

  const ringClasses = {
    sm: 'ring-2',
    md: 'ring-2',
    lg: 'ring-[3px]'
  };

  const title = teamName 
    ? `${teamName} ${tier === 'superfan' ? 'Superfan' : 'Fan'}` 
    : `${tier === 'superfan' ? 'Superfan' : 'Fan'} Badge`;

  // If we have a team logo, show it instead of generic icons
  if (teamLogoUrl) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className={cn(
          "rounded-full overflow-hidden flex-shrink-0 transition-transform",
          onClick && "cursor-pointer hover:scale-110 active:scale-95",
          !onClick && "cursor-default",
          sizeClasses[size],
          // Ring + shadow for prominence
          tier === 'superfan' && `${ringClasses[size]} ring-yellow-400 shadow-lg shadow-yellow-400/50`,
          tier === 'basic' && `${ringClasses[size]} ring-primary shadow-md shadow-primary/30`,
          className
        )}
        title={title}
      >
        <img 
          src={teamLogoUrl} 
          alt={teamName || 'Team badge'}
          className="w-full h-full object-cover bg-background"
          loading="lazy"
        />
      </button>
    );
  }

  // Fallback to icons if no logo
  if (tier === 'superfan') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className={cn(
          "transition-transform",
          onClick && "cursor-pointer hover:scale-110 active:scale-95",
          !onClick && "cursor-default"
        )}
        title={title}
      >
        <Crown 
          className={cn(
            sizeClasses[size],
            "text-yellow-400 drop-shadow-[0_0_4px_rgba(250,204,21,0.5)]",
            className
          )}
        />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "transition-transform",
        onClick && "cursor-pointer hover:scale-110 active:scale-95",
        !onClick && "cursor-default"
      )}
      title={title}
    >
      <Star 
        className={cn(
          sizeClasses[size],
          "text-blue-400",
          className
        )}
      />
    </button>
  );
}
