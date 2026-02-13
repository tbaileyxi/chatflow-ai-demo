import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useShadowBets } from '@/hooks/useShadowBets';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, TrendingUp, TrendingDown, Trophy, Clock, Check, X, Target, Coins, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isPast, formatDistanceToNow } from 'date-fns';

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

export default function Ledger() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filterTeamId = searchParams.get('teamId');
  const filterHuddleId = searchParams.get('huddleId');
  const { user } = useAuth();
  const { portfolio, loading: portfolioLoading, winRate, profit } = usePortfolio();
  const { openBets, pendingBets, closedBets, loading: betsLoading } = useShadowBets();
  const [teamMarkets, setTeamMarkets] = useState<TeamMarkets[]>([]);
  const [marketsLoading, setMarketsLoading] = useState(true);
  const [filterTeamName, setFilterTeamName] = useState<string | null>(null);

  useEffect(() => {
    fetchMarkets();
  }, [filterTeamId, filterHuddleId]);

  const fetchMarkets = async () => {
    try {
      let query = supabase
        .from('kalshi_markets')
        .select('id, question, current_yes_price, event_start_time, is_resolved, resolution, team_id, huddle_id')
        .order('event_start_time', { ascending: true });

      // Filter by team or huddle if provided
      if (filterTeamId) {
        query = query.eq('team_id', filterTeamId);
      } else if (filterHuddleId) {
        query = query.eq('huddle_id', filterHuddleId);
      }

      const { data: markets } = await query;

      if (!markets?.length) {
        // Still fetch team name for header even if no markets
        if (filterTeamId) {
          const { data: team } = await supabase.from('teams').select('name').eq('id', filterTeamId).single();
          setFilterTeamName(team?.name || null);
        }
        setTeamMarkets([]);
        setMarketsLoading(false);
        return;
      }

      // Get unique team IDs
      const teamIds = [...new Set(markets.filter(m => m.team_id).map(m => m.team_id!))];
      
      const { data: teams } = await supabase
        .from('teams')
        .select('id, name, logo_url')
        .in('id', teamIds);

      const teamMap = new Map(teams?.map(t => [t.id, { name: t.name, logo: t.logo_url }]) || []);

      if (filterTeamId && teamMap.has(filterTeamId)) {
        setFilterTeamName(teamMap.get(filterTeamId)!.name);
      }

      // Group by team
      const grouped = new Map<string, { team_name: string; team_logo: string | null; markets: KalshiMarket[] }>();
      
      for (const m of markets) {
        const key = m.team_id || 'general';
        const teamInfo = m.team_id ? teamMap.get(m.team_id) : null;
        if (!grouped.has(key)) {
          grouped.set(key, {
            team_name: teamInfo?.name || 'General',
            team_logo: teamInfo?.logo || null,
            markets: []
          });
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

  return (
    <div className="min-h-screen-dynamic bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 px-4 py-3 border-b border-border/30 bg-background/95 backdrop-blur-sm safe-area-inset-top">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="h-9 w-9 p-0 rounded-full">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Prediction Ledger</h1>
            {filterTeamName && (
              <p className="text-xs text-muted-foreground">{filterTeamName} markets</p>
            )}
          </div>
          {filterTeamId && (
            <Button variant="outline" size="sm" onClick={() => navigate('/ledger')} className="text-xs">
              View All
            </Button>
          )}
        </div>
      </div>

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
                <p className="text-2xl font-black text-foreground">{portfolio?.total_chips || 1000}¢</p>
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
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded font-bold",
                        bet.position === 'YES' ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                      )}>
                        {bet.position} for {bet.chips_risked}¢
                      </span>
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
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded font-bold",
                        bet.position === 'YES' ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                      )}>
                        {bet.position} for {bet.chips_risked}¢
                      </span>
                      <span className="text-xs text-amber-400">⏳ Awaiting result...</span>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Closed Markets */}
          <section>
            <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <Trophy className="h-4 w-4" /> History ({closedBets.length})
            </h3>
            {closedBets.length === 0 ? (
              <Card className="p-6 text-center text-sm text-muted-foreground border-dashed">
                Place your first bet to get started!
              </Card>
            ) : (
              <div className="space-y-2">
                {closedBets.map(bet => (
                  <Card key={bet.id} className={cn(
                    "p-4 border-2",
                    bet.won ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"
                  )}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold text-foreground flex-1">{bet.market?.question}</p>
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ml-2 shrink-0",
                        bet.won ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                      )}>
                        {bet.won ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        {bet.won ? `+${(bet.chips_won || 100) - bet.chips_risked}¢` : `-${bet.chips_risked}¢`}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Picked {bet.position} • {bet.market?.resolution ? `Resolved: ${bet.market.resolution}` : ''}
                    </div>
                  </Card>
                ))}
              </div>
            )}
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
                      {group.team_logo && (
                        <img src={group.team_logo} alt={group.team_name} className="h-5 w-5 rounded-full object-contain" />
                      )}
                      <p className="text-sm font-bold text-foreground">{group.team_name}</p>
                      <span className="text-xs text-muted-foreground">({group.markets.length})</span>
                    </div>
                    <div className="space-y-1.5">
                      {group.markets.map((market) => (
                        <Card key={market.id} className={cn(
                          "p-3 border-border/50",
                          market.is_resolved && "opacity-60"
                        )}>
                          <p className="text-xs font-medium text-foreground mb-1">{market.question}</p>
                          <div className="flex items-center justify-between">
                            {market.current_yes_price != null ? (
                              <span className="text-[10px] text-muted-foreground">
                                YES {market.current_yes_price}¢ / NO {100 - market.current_yes_price}¢
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">Price unavailable</span>
                            )}
                            {market.is_resolved ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                                Resolved: {market.resolution}
                              </span>
                            ) : market.event_start_time ? (
                              <span className="text-[10px] text-muted-foreground">
                                {formatDistanceToNow(new Date(market.event_start_time), { addSuffix: true })}
                              </span>
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
    </div>
  );
}
