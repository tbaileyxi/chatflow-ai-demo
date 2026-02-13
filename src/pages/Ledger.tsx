import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useShadowBets } from '@/hooks/useShadowBets';
import { usePremium } from '@/hooks/usePremium';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowLeft, TrendingUp, TrendingDown, Trophy, Clock, Check, X, Target, Coins, BarChart3, Settings, Share2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { PremiumBanner } from '@/components/premium/PremiumBanner';
import { PremiumBadge } from '@/components/premium/PremiumBadge';
import { BetShareModal } from '@/components/sharing/BetShareModal';
import { UserCompareModal } from '@/components/sharing/UserCompareModal';
import { toast } from 'sonner';

interface KalshiMarket {
  id: string;
  question: string;
  current_yes_price: number | null;
  event_start_time: string | null;
  is_resolved: boolean | null;
  resolution: string | null;
  team_id: string | null;
  huddle_id: string | null;
}

interface TeamMarkets {
  team_name: string;
  team_logo: string | null;
  markets: KalshiMarket[];
}

interface LeaderboardEntry {
  user_id: string;
  username: string;
  display_name: string | null;
  total_chips: number;
  win_rate: number;
  total_bets: number;
  profit: number;
  is_premium: boolean;
}

export default function Ledger() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filterTeamId = searchParams.get('teamId');
  const filterHuddleId = searchParams.get('huddleId');
  const premiumStatus = searchParams.get('premium');
  const { user } = useAuth();
  const { isPremium } = usePremium();
  const { portfolio, loading: portfolioLoading, winRate, profit, isOutOfChips, minimumChips, startingChips } = usePortfolio();
  const { openBets, pendingBets, closedBets, loading: betsLoading } = useShadowBets(undefined, isPremium ? undefined : 30);
  const [teamMarkets, setTeamMarkets] = useState<TeamMarkets[]>([]);
  const [marketsLoading, setMarketsLoading] = useState(true);
  const [filterTeamName, setFilterTeamName] = useState<string | null>(null);
  
  // Share modal state
  const [shareBet, setShareBet] = useState<any>(null);
  const [shareOpen, setShareOpen] = useState(false);
  
  // Leaderboard state
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState('all');
  
  // Compare modal
  const [compareUser, setCompareUser] = useState<LeaderboardEntry | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  
  // Share stats
  const [shareCount, setShareCount] = useState(0);

  // Get username for share card
  const [username, setUsername] = useState<string>('');
  
  useEffect(() => {
    if (user) {
      supabase.from('profiles').select('username').eq('user_id', user.id).single().then(({ data }) => {
        setUsername(data?.username || '');
      });
    }
  }, [user]);

  // Handle premium success callback
  useEffect(() => {
    if (premiumStatus === 'success') {
      toast.success('Welcome to Premium! You now have 500¢ bonus chips! ⭐');
    }
  }, [premiumStatus]);

  useEffect(() => {
    fetchMarkets();
  }, [filterTeamId, filterHuddleId]);

  // Fetch share count
  useEffect(() => {
    if (!user) return;
    supabase.from('shares').select('id', { count: 'exact', head: true }).eq('user_id', user.id).then(({ count }) => {
      setShareCount(count || 0);
    });
  }, [user]);

  // Fetch leaderboard
  useEffect(() => {
    if (!user || !filterHuddleId) return;
    fetchLeaderboard();
  }, [user, filterHuddleId, leaderboardPeriod]);

  const fetchLeaderboard = async () => {
    if (!filterHuddleId) return;
    setLeaderboardLoading(true);
    try {
      const { data } = await supabase.rpc('get_huddle_leaderboard', { p_huddle_id: filterHuddleId });
      const entries: LeaderboardEntry[] = ((data as any[]) || []).map((d: any) => ({
        user_id: d.user_id,
        username: d.username || 'User',
        display_name: d.display_name,
        total_chips: d.total_chips || 1000,
        win_rate: d.total_bets > 0 ? Math.round((d.wins / d.total_bets) * 100) : 0,
        total_bets: d.total_bets || 0,
        profit: d.profit || 0,
        is_premium: false,
      }));

      // Limit free users to top 10
      setLeaderboard(isPremium ? entries : entries.slice(0, 10));
    } catch (err) {
      console.error('Leaderboard error:', err);
    } finally {
      setLeaderboardLoading(false);
    }
  };

  const fetchMarkets = async () => {
    try {
      let query = supabase
        .from('kalshi_markets')
        .select('id, question, current_yes_price, event_start_time, is_resolved, resolution, team_id, huddle_id')
        .order('event_start_time', { ascending: true });

      if (filterTeamId) {
        query = query.eq('team_id', filterTeamId);
      } else if (filterHuddleId) {
        query = query.eq('huddle_id', filterHuddleId);
      }

      const { data: markets } = await query;

      if (!markets?.length) {
        if (filterTeamId) {
          const { data: team } = await supabase.from('teams').select('name').eq('id', filterTeamId).single();
          setFilterTeamName(team?.name || null);
        }
        setTeamMarkets([]);
        setMarketsLoading(false);
        return;
      }

      const teamIds = [...new Set(markets.filter(m => m.team_id).map(m => m.team_id!))];
      const { data: teams } = await supabase.from('teams').select('id, name, logo_url').in('id', teamIds);
      const teamMap = new Map(teams?.map(t => [t.id, { name: t.name, logo: t.logo_url }]) || []);

      if (filterTeamId && teamMap.has(filterTeamId)) {
        setFilterTeamName(teamMap.get(filterTeamId)!.name);
      }

      const grouped = new Map<string, { team_name: string; team_logo: string | null; markets: KalshiMarket[] }>();
      for (const m of markets) {
        const key = m.team_id || 'general';
        const teamInfo = m.team_id ? teamMap.get(m.team_id) : null;
        if (!grouped.has(key)) {
          grouped.set(key, { team_name: teamInfo?.name || 'General', team_logo: teamInfo?.logo || null, markets: [] });
        }
        grouped.get(key)!.markets.push(m);
      }

      setTeamMarkets(Array.from(grouped.values()).sort((a, b) => a.team_name.localeCompare(b.team_name)));
    } catch (err) {
      console.error('Error fetching markets:', err);
    } finally {
      setMarketsLoading(false);
    }
  };

  if (!user) {
    navigate('/auth');
    return null;
  }

  const loading = portfolioLoading || betsLoading;

  const currentUserStats = {
    username: username || 'You',
    chips: portfolio?.total_chips || startingChips,
    winRate,
    totalBets: portfolio?.total_bets || 0,
    profit,
    isPremium,
  };

  return (
    <div className="min-h-screen-dynamic bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 px-4 py-3 border-b border-border/30 bg-background/95 backdrop-blur-sm safe-area-inset-top">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="h-9 w-9 p-0 rounded-full">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">Prediction Ledger</h1>
              {isPremium && <PremiumBadge />}
            </div>
            {filterTeamName && (
              <p className="text-xs text-muted-foreground">{filterTeamName} markets</p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/settings')} className="h-9 w-9 p-0 rounded-full">
            <Settings className="h-4 w-4" />
          </Button>
          {filterTeamId && (
            <Button variant="outline" size="sm" onClick={() => navigate('/ledger')} className="text-xs">
              View All
            </Button>
          )}
        </div>
      </div>

      {/* Premium banner for locked-out free users */}
      {!isPremium && isOutOfChips && (
        <div className="px-4 mt-3">
          <PremiumBanner />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground">Loading...</div>
      ) : (
        <div className="px-4 space-y-6 mt-4">
          {/* Portfolio Overview */}
          <Card className="p-5 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <div className="flex items-center gap-2 mb-4">
              <Coins className="h-5 w-5 text-primary" />
              <h2 className="font-bold text-lg">Portfolio</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase">Chips</p>
                <p className="text-2xl font-black text-foreground">{portfolio?.total_chips || startingChips}¢</p>
                {isPremium && (
                  <p className="text-[10px] text-muted-foreground">min: {minimumChips}¢</p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">P/L</p>
                <div className="flex items-center gap-1">
                  {profit >= 0 ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
                  <p className={cn("text-2xl font-black", profit >= 0 ? "text-green-500" : "text-red-500")}>
                    {profit >= 0 ? '+' : ''}{profit}¢
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Win Rate</p>
                <p className="text-lg font-bold text-foreground">{winRate}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Total Bets</p>
                <p className="text-lg font-bold text-foreground">{portfolio?.total_bets || 0}</p>
              </div>
            </div>
          </Card>

          {/* Open Bets */}
          <section>
            <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <Target className="h-4 w-4" /> Open Bets ({openBets.length})
            </h3>
            {openBets.length === 0 ? (
              <Card className="p-6 text-center text-sm text-muted-foreground border-dashed">
                No active bets. Check chat for new props!
              </Card>
            ) : (
              <div className="space-y-2">
                {openBets.map(bet => (
                  <Card key={bet.id} className="p-4 border-border/50">
                    <p className="text-sm font-semibold text-foreground mb-1">{bet.market?.question}</p>
                    <div className="flex items-center justify-between">
                      <span className={cn("text-xs px-2 py-0.5 rounded font-bold",
                        bet.position === 'YES' ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                      )}>{bet.position} for {bet.chips_risked}¢</span>
                      {bet.market?.event_start_time && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(bet.market.event_start_time), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* Pending Results */}
          {pendingBets.length > 0 && (
            <section>
              <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" /> Pending Results ({pendingBets.length})
              </h3>
              <div className="space-y-2">
                {pendingBets.map(bet => (
                  <Card key={bet.id} className="p-4 border-amber-500/30 bg-amber-500/5">
                    <p className="text-sm font-semibold text-foreground mb-1">{bet.market?.question}</p>
                    <div className="flex items-center justify-between">
                      <span className={cn("text-xs px-2 py-0.5 rounded font-bold",
                        bet.position === 'YES' ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                      )}>{bet.position} for {bet.chips_risked}¢</span>
                      <span className="text-xs text-amber-400">⏳ Awaiting result...</span>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Settled Bets / History */}
          <section>
            <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <Trophy className="h-4 w-4" /> History ({closedBets.length})
              {!isPremium && <span className="text-[10px] font-normal">(last 30 days)</span>}
            </h3>
            {closedBets.length === 0 ? (
              <Card className="p-6 text-center text-sm text-muted-foreground border-dashed">
                Place your first bet to get started!
              </Card>
            ) : (
              <div className="space-y-2">
                {closedBets.map(bet => (
                  <Card key={bet.id} className={cn("p-4 border-2",
                    bet.won ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"
                  )}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold text-foreground flex-1">{bet.market?.question}</p>
                      <div className="flex items-center gap-1.5 ml-2 shrink-0">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1",
                          bet.won ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                        )}>
                          {bet.won ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          {bet.won ? `+${(bet.chips_won || 100) - bet.chips_risked}¢` : `-${bet.chips_risked}¢`}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn("h-7 w-7 rounded-full", bet.won ? "text-green-400 hover:bg-green-500/10" : "text-muted-foreground hover:bg-muted")}
                          onClick={() => { setShareBet(bet); setShareOpen(true); }}
                        >
                          <Share2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Picked {bet.position} • {bet.market?.resolution ? `Resolved: ${bet.market.resolution}` : ''}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* Leaderboard */}
          {filterHuddleId && (
            <section>
              <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" /> Leaderboard
              </h3>
              
              {isPremium && (
                <Tabs value={leaderboardPeriod} onValueChange={setLeaderboardPeriod} className="mb-3">
                  <TabsList className="w-full">
                    <TabsTrigger value="week" className="flex-1 text-xs">This Week</TabsTrigger>
                    <TabsTrigger value="month" className="flex-1 text-xs">This Month</TabsTrigger>
                    <TabsTrigger value="all" className="flex-1 text-xs">All-Time</TabsTrigger>
                  </TabsList>
                </Tabs>
              )}

              {leaderboardLoading ? (
                <Card className="p-6 text-center text-sm text-muted-foreground">Loading...</Card>
              ) : leaderboard.length === 0 ? (
                <Card className="p-6 text-center text-sm text-muted-foreground border-dashed">
                  No leaderboard data yet.
                </Card>
              ) : (
                <div className="space-y-1.5">
                  {leaderboard.map((entry, i) => {
                    const isYou = entry.user_id === user?.id;
                    return (
                      <Card key={entry.user_id} className={cn("p-3 flex items-center gap-3", isYou && "border-primary/30 bg-primary/5")}>
                        <span className={cn("text-sm font-bold w-6 text-center",
                          i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-amber-600" : "text-muted-foreground"
                        )}>
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold text-foreground truncate">
                              {isYou ? 'You' : `@${entry.username}`}
                            </span>
                            {entry.is_premium && <PremiumBadge size="sm" />}
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {entry.win_rate}% win • {entry.total_bets} bets
                          </span>
                        </div>
                        <span className={cn("text-sm font-bold",
                          entry.profit >= 0 ? "text-green-500" : "text-red-400"
                        )}>
                          {entry.profit >= 0 ? '+' : ''}{entry.profit}¢
                        </span>
                        {isPremium && !isYou && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-full"
                            onClick={() => { setCompareUser(entry); setCompareOpen(true); }}
                          >
                            <BarChart3 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </Card>
                    );
                  })}
                  {!isPremium && leaderboard.length >= 10 && (
                    <p className="text-center text-xs text-muted-foreground py-2">
                      ⭐ Upgrade to Premium to see full rankings
                    </p>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Your Shares */}
          <section>
            <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <Share2 className="h-4 w-4" /> Your Shares
            </h3>
            <Card className="p-4 border-border/50">
              <p className="text-sm text-foreground">
                Total shares: <span className="font-bold">{shareCount}</span>
              </p>
              {!isPremium && shareCount > 0 && (
                <p className="text-[10px] text-muted-foreground mt-1">⭐ Upgrade to Premium for detailed share analytics</p>
              )}
            </Card>
          </section>

          {/* Browse All Markets by Team */}
          <section>
            <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Browse Markets ({teamMarkets.reduce((sum, t) => sum + t.markets.length, 0)})
            </h3>
            {marketsLoading ? (
              <Card className="p-6 text-center text-sm text-muted-foreground">Loading markets...</Card>
            ) : teamMarkets.length === 0 ? (
              <Card className="p-6 text-center text-sm text-muted-foreground border-dashed">
                No markets available yet. Markets sync automatically before games.
              </Card>
            ) : (
              <div className="space-y-4">
                {teamMarkets.map((group) => (
                  <div key={group.team_name}>
                    <div className="flex items-center gap-2 mb-2">
                      {group.team_logo && <img src={group.team_logo} alt={group.team_name} className="h-5 w-5 rounded-full object-contain" />}
                      <p className="text-sm font-bold text-foreground">{group.team_name}</p>
                      <span className="text-xs text-muted-foreground">({group.markets.length})</span>
                    </div>
                    <div className="space-y-1.5">
                      {group.markets.map((market) => (
                        <Card key={market.id} className={cn("p-3 border-border/50", market.is_resolved && "opacity-60")}>
                          <p className="text-xs font-medium text-foreground mb-1">{market.question}</p>
                          <div className="flex items-center justify-between">
                            {market.current_yes_price != null ? (
                              <span className="text-[10px] text-muted-foreground">YES {market.current_yes_price}¢ / NO {100 - market.current_yes_price}¢</span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">Price unavailable</span>
                            )}
                            {market.is_resolved ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">Resolved: {market.resolution}</span>
                            ) : market.event_start_time ? (
                              <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(market.event_start_time), { addSuffix: true })}</span>
                            ) : null}
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Share Modal */}
      {shareBet && (
        <BetShareModal
          open={shareOpen}
          onOpenChange={setShareOpen}
          bet={shareBet}
          winRate={winRate}
          totalBets={portfolio?.total_bets || 0}
          username={username}
        />
      )}

      {/* Compare Modal */}
      {compareUser && (
        <UserCompareModal
          open={compareOpen}
          onOpenChange={setCompareOpen}
          currentUser={currentUserStats}
          compareUser={{
            username: compareUser.username,
            chips: compareUser.total_chips,
            winRate: compareUser.win_rate,
            totalBets: compareUser.total_bets,
            profit: compareUser.profit,
            isPremium: compareUser.is_premium,
          }}
        />
      )}
    </div>
  );
}
