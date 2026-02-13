import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Trophy, Target } from 'lucide-react';

interface UserStats {
  username: string;
  chips: number;
  winRate: number;
  totalBets: number;
  profit: number;
  isPremium?: boolean;
}

interface UserCompareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: UserStats;
  compareUser: UserStats;
}

export function UserCompareModal({ open, onOpenChange, currentUser, compareUser }: UserCompareModalProps) {
  const statRows = [
    { label: 'Chips', key: 'chips' as const, suffix: '¢', icon: Target },
    { label: 'Win Rate', key: 'winRate' as const, suffix: '%', icon: Trophy },
    { label: 'Total Bets', key: 'totalBets' as const, suffix: '', icon: Target },
    { label: 'Profit', key: 'profit' as const, suffix: '¢', icon: TrendingUp },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="text-center">Head to Head</SheetTitle>
        </SheetHeader>

        <div className="mt-4 pb-6 space-y-3">
          {/* Names header */}
          <div className="flex items-center justify-between px-4 mb-2">
            <span className="text-sm font-bold text-foreground">@{currentUser.username}</span>
            <span className="text-xs text-muted-foreground uppercase">vs</span>
            <span className="text-sm font-bold text-foreground">@{compareUser.username}</span>
          </div>

          {/* Stat rows */}
          {statRows.map(({ label, key, suffix, icon: Icon }) => {
            const a = currentUser[key];
            const b = compareUser[key];
            const aWins = a > b;
            const bWins = b > a;

            return (
              <div key={key} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-muted/50">
                <div className={cn(
                  "flex-1 text-right text-lg font-bold",
                  aWins ? "text-green-500" : bWins ? "text-red-400" : "text-foreground"
                )}>
                  {key === 'profit' && a >= 0 ? '+' : ''}{a}{suffix}
                </div>
                <div className="flex flex-col items-center w-20 shrink-0">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground mb-0.5" />
                  <span className="text-[10px] text-muted-foreground uppercase">{label}</span>
                </div>
                <div className={cn(
                  "flex-1 text-lg font-bold",
                  bWins ? "text-green-500" : aWins ? "text-red-400" : "text-foreground"
                )}>
                  {key === 'profit' && b >= 0 ? '+' : ''}{b}{suffix}
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
