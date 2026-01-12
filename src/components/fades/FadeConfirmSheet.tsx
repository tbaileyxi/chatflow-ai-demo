import React, { useState } from 'react';
import { format } from 'date-fns';
import { Zap, Lock, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface FadeOption {
  type: string;
  label: string;
  line_value: number;
  description: string;
}

interface GameData {
  id: string;
  home_team: string;
  away_team: string;
  commence_time: string;
}

interface FadeConfirmSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  option: FadeOption | null;
  game: GameData | null;
  maxStake: number;
  isPrivate?: boolean;
  onConfirm: (stake: number) => Promise<void>;
}

export const FadeConfirmSheet: React.FC<FadeConfirmSheetProps> = ({
  open,
  onOpenChange,
  option,
  game,
  maxStake,
  isPrivate = false,
  onConfirm,
}) => {
  const [selectedStake, setSelectedStake] = useState(10);
  const [confirming, setConfirming] = useState(false);

  // Stake options based on huddle type
  const stakeOptions = isPrivate ? [10, 25, 50, 100, 200] : [5, 10];
  const filteredStakes = stakeOptions.filter(s => s <= maxStake);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm(selectedStake);
    } finally {
      setConfirming(false);
    }
  };

  if (!option || !game) return null;

  const gameTime = new Date(game.commence_time);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Confirm Your Fade
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            Pick your stake and lock it in
          </p>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Game Info */}
          <div className="p-4 rounded-xl bg-muted/50 border border-border">
            <div className="text-sm font-semibold text-foreground mb-1">
              {game.away_team} @ {game.home_team}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
              <Lock className="h-3 w-3" />
              Locks at {format(gameTime, 'MMM d, h:mm a')}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-primary font-bold text-lg">{option.label}</span>
              <span className={cn(
                "text-[10px] px-2 py-0.5 rounded-full",
                isPrivate ? "bg-amber-500/20 text-amber-400" : "bg-green-500/20 text-green-400"
              )}>
                {isPrivate ? 'Private — cash enabled' : 'Public — no cash'}
              </span>
            </div>
          </div>

          {/* Stake Selector */}
          <div>
            <label className="text-sm font-medium text-foreground mb-3 block">
              Select Stake
            </label>
            <div className="flex gap-2 flex-wrap">
              {filteredStakes.map((stake) => (
                <button
                  key={stake}
                  onClick={() => setSelectedStake(stake)}
                  className={cn(
                    "flex-1 min-w-[60px] py-3 px-4 rounded-xl font-bold text-lg transition-all",
                    selectedStake === stake
                      ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background"
                      : "bg-muted hover:bg-muted/80 text-foreground"
                  )}
                >
                  ${stake}
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="p-4 rounded-xl bg-primary/10 border border-primary/30">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Your bet</span>
              <span className="font-bold text-foreground">{option.label}</span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm text-muted-foreground">Stake</span>
              <span className="font-bold text-primary text-xl">${selectedStake}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              If someone fades you and you win, they owe you ${selectedStake}.
            </p>
          </div>

          {/* Confirm Button */}
          <Button
            onClick={handleConfirm}
            disabled={confirming}
            className="w-full h-14 text-lg font-bold bg-primary hover:bg-primary/90"
          >
            {confirming ? (
              <span className="flex items-center gap-2">
                <div className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Posting...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Take {option.label} for ${selectedStake}
              </span>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};