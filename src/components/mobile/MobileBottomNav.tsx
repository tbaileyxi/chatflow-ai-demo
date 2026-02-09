import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { MessageSquare, Sparkles, User, Compass, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  to?: string;
  badge?: number;
  onClick?: () => void;
  tooltip?: string;
}

interface MobileBottomNavProps {
  onPickEmClick?: () => void;
  showPickEm?: boolean;
}

export const MobileBottomNav = ({ onPickEmClick, showPickEm }: MobileBottomNavProps) => {
  const location = useLocation();

  const navItems: NavItem[] = [
    { icon: MessageSquare, label: 'Huddles', to: '/app' },
    ...(showPickEm ? [{
      icon: Trophy,
      label: "Pick 'Em",
      onClick: onPickEmClick,
      tooltip: 'Heat Check - Test your predictions!'
    }] : []),
    { icon: Compass, label: 'Hosted', to: '/huddle-search' },
    { icon: Sparkles, label: 'Spotlight', to: '/spotlight' },
    { icon: User, label: 'Profile', to: '/profile' },
  ];

  return (
    <TooltipProvider>
      <nav className="fixed bottom-0 left-0 right-0 z-50 safe-area-inset-bottom">
        <div className="glass-header border-t border-primary/10 bg-background/95 backdrop-blur-sm">
          <div className="flex items-center justify-around px-2 py-2 h-12">
            {navItems.map((item, idx) => {
              const isActive = item.to && (location.pathname === item.to || 
                (item.to === '/app' && location.pathname === '/'));
              
              const content = (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  className={cn(
                    "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200",
                    "min-w-[64px] min-h-[44px] relative touch-manipulation",
                    isActive 
                      ? "bg-primary/20 text-primary" 
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  )}
                >
                  <div className="relative">
                    <item.icon className={cn(
                      "h-5 w-5 transition-transform duration-200",
                      isActive && "scale-110"
                    )} />
                    {item.badge && item.badge > 0 && (
                      <Badge 
                        variant="destructive" 
                        className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs flex items-center justify-center"
                      >
                        {item.badge > 99 ? '99+' : item.badge}
                      </Badge>
                    )}
                  </div>
                  <span className={cn(
                    "text-xs font-medium transition-all duration-200",
                    isActive ? "opacity-100" : "opacity-60"
                  )}>
                    {item.label}
                  </span>
                </button>
              );

              if (item.to) {
                return (
                  <NavLink key={item.label} to={item.to}>
                    {content}
                  </NavLink>
                );
              }

              if (item.tooltip) {
                return (
                  <Tooltip key={item.label}>
                    <TooltipTrigger asChild>
                      {content}
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-primary text-primary-foreground">
                      <p>{item.tooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return content;
            })}
          </div>
        </div>
      </nav>
    </TooltipProvider>
  );
};
