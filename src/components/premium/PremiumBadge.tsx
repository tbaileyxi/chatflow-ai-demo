import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PremiumBadgeProps {
  className?: string;
  size?: 'sm' | 'md';
}

export function PremiumBadge({ className, size = 'sm' }: PremiumBadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 font-bold",
      size === 'sm' ? "text-[10px]" : "text-xs",
      "text-yellow-500",
      className
    )}>
      <Star className={cn(
        "fill-yellow-500 text-yellow-500",
        size === 'sm' ? "h-3 w-3" : "h-3.5 w-3.5"
      )} />
      <span>PRO</span>
    </span>
  );
}
