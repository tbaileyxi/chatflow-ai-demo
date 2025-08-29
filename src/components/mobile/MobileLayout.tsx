import React, { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface MobileLayoutProps {
  children: ReactNode;
  className?: string;
  hasBottomNav?: boolean;
}

export const MobileLayout = ({ children, className, hasBottomNav = true }: MobileLayoutProps) => {
  return (
    <div className={cn(
      "min-h-screen-dynamic bg-background flex flex-col",
      "safe-area-inset-top safe-area-inset-bottom",
      className
    )}>
      <div className={cn(
        "flex-1 flex flex-col overflow-hidden",
        hasBottomNav && "pb-16"
      )}>
        {children}
      </div>
    </div>
  );
};