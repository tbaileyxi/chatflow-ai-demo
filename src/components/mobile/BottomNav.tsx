import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { User, Compass, Grid, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  to: string;
  badge?: number;
  authRequired?: boolean;
}

export const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Navigation items for logged-in users (Home, Discover, Ledger, Profile)
  const loggedInNavItems: NavItem[] = [
    { icon: Grid, label: 'Home', to: '/' },
    { icon: Compass, label: 'Discover', to: '/huddle-search' },
    { icon: Receipt, label: 'Ledger', to: '/ledger', authRequired: true },
    { icon: User, label: 'Profile', to: '/profile', authRequired: true },
  ];

  // Navigation items for anonymous users
  const anonymousNavItems: NavItem[] = [
    { icon: Grid, label: 'Home', to: '/' },
    { icon: Compass, label: 'Discover', to: '/huddle-search' },
  ];

  const navItems = user ? loggedInNavItems : anonymousNavItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-area-inset-bottom">
      <div className="glass-header border-t border-white/10">
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200",
                  "min-w-[64px] relative",
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
              </NavLink>
            );
          })}
          
          {/* Yellow Join CTA for anonymous users */}
          {!user && (
            <Button
              onClick={() => navigate('/auth?signup=true')}
              className={cn(
                "flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-200",
                "min-w-[64px] h-auto",
                "bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
              )}
            >
              <span className="text-xs font-bold">
                Join
              </span>
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
};
