import React from 'react';
import { Star, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserBadgeIconProps {
  tier: 'basic' | 'superfan';
  teamName?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function UserBadgeIcon({ tier, teamName, size = 'sm', className }: UserBadgeIconProps) {
  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4'
  };

  if (tier === 'superfan') {
    return (
      <span title={teamName ? `${teamName} Superfan` : 'Superfan Badge'}>
        <Crown 
          className={cn(
            sizeClasses[size],
            "text-yellow-400 drop-shadow-[0_0_4px_rgba(250,204,21,0.5)]",
            className
          )}
        />
      </span>
    );
  }

  return (
    <span title={teamName ? `${teamName} Fan` : 'Fan Badge'}>
      <Star 
        className={cn(
          sizeClasses[size],
          "text-blue-400",
          className
        )}
      />
    </span>
  );
}
