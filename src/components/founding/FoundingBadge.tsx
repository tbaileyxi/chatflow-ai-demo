import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface FoundingBadgeProps {
  tier: 'charter' | 'founding' | null | undefined;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function FoundingBadge({ tier, children, size = 'md', className }: FoundingBadgeProps) {
  if (!tier) {
    return <>{children}</>;
  }

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  const borderColor = tier === 'charter' ? 'border-[#C0C0C0]' : 'border-[#FFD700]';

  return (
    <div className={cn('relative inline-block', className)}>
      <div className={cn('rounded-full border-2', borderColor, sizeClasses[size])}>
        {children}
      </div>
      {/* Badge overlay at bottom-right */}
      <div className="absolute -bottom-1 -right-1 z-10">
        <img
          src={tier === 'charter' ? '/founding/platinum_badge.png' : '/founding/gold_badge.png'}
          alt={`${tier} member badge`}
          className="w-4 h-4 object-contain"
        />
      </div>
    </div>
  );
}
