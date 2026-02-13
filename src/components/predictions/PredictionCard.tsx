import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Check, X, Loader2, TrendingUp, TrendingDown, Clock, Lock, Star } from 'lucide-react';
import { formatDistanceToNow, isPast, addMinutes } from 'date-fns';
import { usePortfolio } from '@/hooks/usePortfolio';
import { PremiumUpgradeModal } from '@/components/premium/PremiumUpgradeModal';

interface Market {
  id: string;
  question: string;
  current_yes_price: number;
  market_type: string;
  event_start_time: string;
  is_resolved: boolean;
  resolution: string | null;
  kalshi_ticker: string;
}

interface PredictionCardProps {
  market: Market;
  huddleId: string;
}

interface BetStats {
  total: number;
  yesCount: number;
  noCount: number;
}

export const PredictionCard: React.FC<PredictionCardProps> = ({ market, huddleId }) => {
  const { user } = useAuth();
  const { portfolio, isPremium, minimumChips, isOutOfChips } = usePortfolio();
  const [userBet, setUserBet] = useState<{ position: string; chips_risked: number; won?: boolean | null; chips_won?: number } | null>(null);
  const [stats, setStats] = useState<BetStats>({ total: 0, yesCount: 0, noCount: 0 });
  const [placing, setPlacing] = useState(false);
  const [loadingBet, setLoadingBet] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const yesCost = market.current_yes_price;
  const noCost = 100 - market.current_yes_price;
  const isLocked = market.event_start_time && isPast(addMinutes(new Date(market.event_start_time), -5));
  const isResolved = market.is_resolved;
  const currentChips = portfolio?.total_chips ?? 0;

  useEffect(() => {
    if (!user) { setLoadingBet(false); return; }

    const fetchBetAndStats = async () => {
      const [{ data: betData }, { data: statsData }] = await Promise.all([
        supabase.from('shadow_bets').select('position, chips_risked, won, chips_won')
          .eq('user_id', user.id).eq('market_id', market.id).maybeSingle(),
        supabase.from('shadow_bets').select('position').eq('market_id', market.id)
      ]);
      if (betData) setUserBet(betData);
      if (statsData) {
        setStats({
          total: statsData.length,
          yesCount: statsData.filter(b => b.position === 'YES').length,
          noCount: statsData.filter(b => b.position === 'NO').length,
        });
      }
      setLoadingBet(false);
    };
    fetchBetAndStats();
  }, [user, market.id]);

  useEffect(() => {
    const channel = supabase
      .channel(`prediction-${market.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shadow_bets', filter: `market_id=eq.${market.id}` }, (payload) => {
        const newBet = payload.new as any;
        setStats(prev => ({
          total: prev.total + 1,
          yesCount: prev.yesCount + (newBet.position === 'YES' ? 1 : 0),
          noCount: prev.noCount + (newBet.position === 'NO' ? 1 : 0),
        }));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [market.id]);

  const handlePlaceBet = useCallback(async (position: 'YES' | 'NO') => {
    if (!user || placing || userBet || isLocked || isResolved) return;

    // Check chips before calling RPC
    const cost = position === 'YES' ? yesCost : noCost;
    if (!isPremium && currentChips < cost) {
      setShowUpgradeModal(true);
      return;
    }

    setPlacing(true);
    try {
      const { data, error } = await supabase.rpc('place_shadow_bet', {
        p_market_id: market.id, p_huddle_id: huddleId, p_position: position,
      });
      if (error) {
        if (error.message?.includes('OUT_OF_CHIPS')) {
          setShowUpgradeModal(true);
          return;
        }
        throw error;
      }
      const result = data as any;
      setUserBet({ position, chips_risked: result.chips_risked, won: null, chips_won: 0 });
      toast.success(`Bet placed! Risking ${result.chips_risked}¢ to win ${100 - result.chips_risked}¢`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to place bet');
    } finally {
      setPlacing(false);
    }
  }, [user, placing, userBet, isLocked, isResolved, market.id, huddleId, isPremium, currentChips, yesCost, noCost]);

  if (loadingBet) {
    return <Card className="p-3 bg-muted/30 border-border/50 animate-pulse"><div className="h-16" /></Card>;
  }

  const communityYesPct = stats.total > 0 ? Math.round((stats.yesCount / stats.total) * 100) : 50;
  const divergence = communityYesPct - yesCost;

  return (
    <>
      <Card className={cn(
        "p-4 border-2 transition-all",
        isResolved && userBet?.won === true && "border-green-500/40 bg-green-500/5",
        isResolved && userBet?.won === false && "border-red-500/40 bg-red-500/5",
        isResolved && !userBet && "border-border/30 opacity-70",
        !isResolved && userBet && "border-primary/30",
        !isResolved && !userBet && !isLocked && "border-border/50 hover:border-primary/20",
        isLocked && !isResolved && "border-amber-500/30 bg-amber-500/5",
      )}>
        <p className="text-sm font-semibold text-foreground mb-3">{market.question}</p>

        {/* Resolved State */}
        {isResolved && (
          <div className="space-y-2">
            <div className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold",
              market.resolution === 'YES' ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
            )}>
              {market.resolution === 'YES' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
              Resolved: {market.resolution}
            </div>
            {userBet && (
              <div className={cn("text-sm font-medium", userBet.won ? "text-green-400" : "text-red-400")}>
                {userBet.won ? `🏆 You won ${(userBet.chips_won || 100) - userBet.chips_risked}¢!` : `❌ You lost ${userBet.chips_risked}¢`}
              </div>
            )}
          </div>
        )}

        {/* Pre-bet: Free user out of chips */}
        {!isResolved && !userBet && !isLocked && isOutOfChips && !isPremium && (
          <div className="space-y-2">
            <p className="text-sm text-red-400 font-medium">Not enough chips! Upgrade to Premium to keep playing.</p>
            <Button size="sm" onClick={() => setShowUpgradeModal(true)} className="bg-gradient-to-r from-yellow-500 to-amber-600 text-black font-bold">
              <Star className="h-3 w-3 mr-1 fill-current" /> Upgrade Now
            </Button>
          </div>
        )}

        {/* Pre-bet Buttons */}
        {!isResolved && !userBet && !isLocked && !(isOutOfChips && !isPremium) && (
          <div className="space-y-2">
            {/* Low chips warning for premium */}
            {isPremium && currentChips <= 150 && (
              <p className="text-xs text-amber-400 flex items-center gap-1">⚠️ Low chips! You have {currentChips}¢. Bet carefully.</p>
            )}
            {/* Balance display for premium */}
            {isPremium && (
              <p className="text-[10px] text-muted-foreground">Balance: {currentChips}¢ (min: {minimumChips}¢)</p>
            )}
            <div className="flex gap-2">
              <Button onClick={() => handlePlaceBet('YES')} disabled={placing}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold" size="sm">
                {placing ? <Loader2 className="h-4 w-4 animate-spin" /> : <>YES <span className="ml-1 opacity-80">{yesCost}¢</span></>}
              </Button>
              <Button onClick={() => handlePlaceBet('NO')} disabled={placing}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold" size="sm">
                {placing ? <Loader2 className="h-4 w-4 animate-spin" /> : <>NO <span className="ml-1 opacity-80">{noCost}¢</span></>}
              </Button>
            </div>
          </div>
        )}

        {/* Locked */}
        {!isResolved && isLocked && !userBet && (
          <div className="flex items-center gap-2 text-sm text-amber-400"><Lock className="h-4 w-4" /><span>Betting locked</span></div>
        )}

        {/* Post-bet Stats */}
        {!isResolved && userBet && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className={cn("px-2 py-0.5 rounded font-bold text-xs",
                userBet.position === 'YES' ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
              )}>Your pick: {userBet.position} ({userBet.chips_risked}¢)</span>
            </div>
            {stats.total > 0 && (
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Community: {communityYesPct}% YES ({stats.total} bets)</span>
                  <span>Kalshi: {yesCost}%</span>
                </div>
                {Math.abs(divergence) >= 3 && (
                  <div className={cn("flex items-center gap-1", divergence > 0 ? "text-green-400" : "text-red-400")}>
                    {divergence > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    Community is {Math.abs(divergence)}% {divergence > 0 ? 'more' : 'less'} bullish
                  </div>
                )}
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${communityYesPct}%` }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Game time */}
        {!isResolved && market.event_start_time && (
          <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {isPast(new Date(market.event_start_time)) ? 'Game in progress' : formatDistanceToNow(new Date(market.event_start_time), { addSuffix: true })}
          </div>
        )}
      </Card>

      <PremiumUpgradeModal open={showUpgradeModal} onOpenChange={setShowUpgradeModal} />
    </>
  );
};
