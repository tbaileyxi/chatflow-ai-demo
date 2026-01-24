import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCashMode } from '@/hooks/useCashMode';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, DollarSign, TrendingUp, TrendingDown, Clock, Check, X, Zap, History, Lock, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isPast } from 'date-fns';
import { CashModeUpgradeModal } from '@/components/fades/CashModeUpgradeModal';
import { VenmoSetupModal } from '@/components/fades/VenmoSetupModal';

interface LedgerEntry {
  id: string;
  huddle_id: string;
  huddle_name: string;
  net_points: number;
  total_fades: number;
  user_a_wins: number;
  user_b_wins: number;
  opponent_name: string;
}

interface FadeRecord {
  id: string;
  huddle_id: string;
  huddle_name: string;
  line_description: string;
  stake: number;
  status: 'open' | 'locked' | 'settled' | 'expired';
  settlement_status: string;
  winner_id: string | null;
  is_winner: boolean | null;
  is_poster: boolean;
  opponent_name: string;
  created_at: string;
  game_commence_time: string;
  home_team: string;
  away_team: string;
  final_score_home: number | null;
  final_score_away: number | null;
  fade_type: string;
}

export default function Ledger() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { hasCashMode, venmoUsername, loading: cashModeLoading } = useCashMode();
  const [ledgers, setLedgers] = useState<LedgerEntry[]>([]);
  const [openFades, setOpenFades] = useState<FadeRecord[]>([]);
  const [lockedFades, setLockedFades] = useState<FadeRecord[]>([]);
  const [historyFades, setHistoryFades] = useState<FadeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCashModeModal, setShowCashModeModal] = useState(false);
  const [showVenmoSetup, setShowVenmoSetup] = useState(false);

  // Check if we just came from a Cash Mode purchase
  useEffect(() => {
    const cashModeStatus = searchParams.get('cashmode');
    if (cashModeStatus === 'success' && hasCashMode && !venmoUsername) {
      setShowVenmoSetup(true);
      // Clean up URL
      window.history.replaceState({}, '', '/ledger');
    }
  }, [searchParams, hasCashMode, venmoUsername]);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    const fetchData = async () => {
      setLoading(true);

      // Fetch ALL fades where user is participant
      const { data: allFades } = await supabase
        .from('fades')
        .select('*')
        .or(`poster_id.eq.${user.id},accepter_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (allFades && allFades.length > 0) {
        const huddleIds = [...new Set(allFades.map(f => f.huddle_id))];
        const opponentIds = allFades.map(f => 
          f.poster_id === user.id ? f.accepter_id : f.poster_id
        ).filter(Boolean);

        const [{ data: huddles }, { data: profiles }] = await Promise.all([
          supabase.from('huddles').select('id, name').in('id', huddleIds),
          supabase.from('profiles').select('user_id, display_name, username').in('user_id', opponentIds as string[]),
        ]);

        const huddleMap = new Map(huddles?.map(h => [h.id, h.name]) || []);
        const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name || p.username || 'Anonymous']) || []);

        const formatFade = (f: any): FadeRecord => ({
          id: f.id,
          huddle_id: f.huddle_id,
          huddle_name: huddleMap.get(f.huddle_id) || 'Unknown Huddle',
          line_description: f.line_description,
          stake: f.stake,
          status: f.status,
          settlement_status: f.settlement_status || 'unpaid',
          winner_id: f.winner_id,
          is_winner: f.status === 'settled' ? f.winner_id === user.id : null,
          is_poster: f.poster_id === user.id,
          opponent_name: profileMap.get(f.poster_id === user.id ? f.accepter_id : f.poster_id) || 'Waiting...',
          created_at: f.created_at,
          game_commence_time: f.game_commence_time,
          home_team: f.home_team,
          away_team: f.away_team,
          final_score_home: f.final_score_home,
          final_score_away: f.final_score_away,
          fade_type: f.fade_type,
        });

        // Categorize fades
        const open: FadeRecord[] = [];
        const locked: FadeRecord[] = [];
        const history: FadeRecord[] = [];

        allFades.forEach(f => {
          const fade = formatFade(f);
          if (f.status === 'open') {
            open.push(fade);
          } else if (f.status === 'locked') {
            locked.push(fade);
          } else if (f.status === 'settled' || f.status === 'expired') {
            history.push(fade);
          }
        });

        setOpenFades(open);
        setLockedFades(locked);
        setHistoryFades(history);
      }

      // Fetch ledger entries
      const { data: ledgerData } = await supabase
        .from('fade_ledgers')
        .select(`
          id,
          huddle_id,
          net_points,
          total_fades,
          user_a_wins,
          user_b_wins,
          user_a_id,
          user_b_id
        `)
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`);

      if (ledgerData && ledgerData.length > 0) {
        const huddleIds = [...new Set(ledgerData.map(l => l.huddle_id))];
        const opponentIds = ledgerData.map(l => 
          l.user_a_id === user.id ? l.user_b_id : l.user_a_id
        );

        const [{ data: huddles }, { data: profiles }] = await Promise.all([
          supabase.from('huddles').select('id, name').in('id', huddleIds),
          supabase.from('profiles').select('user_id, display_name, username').in('user_id', opponentIds),
        ]);

        const huddleMap = new Map(huddles?.map(h => [h.id, h.name]) || []);
        const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name || p.username || 'Anonymous']) || []);

        const formatted = ledgerData.map(l => ({
          id: l.id,
          huddle_id: l.huddle_id,
          huddle_name: huddleMap.get(l.huddle_id) || 'Unknown Huddle',
          net_points: l.user_a_id === user.id ? l.net_points : -l.net_points,
          total_fades: l.total_fades,
          user_a_wins: l.user_a_wins,
          user_b_wins: l.user_b_wins,
          opponent_name: profileMap.get(l.user_a_id === user.id ? l.user_b_id : l.user_a_id) || 'Anonymous',
        }));

        setLedgers(formatted);
      }

      setLoading(false);
    };

    fetchData();
  }, [user, navigate]);

  if (!user) return null;

  const totalBalance = ledgers.reduce((sum, l) => sum + l.net_points, 0);
  const totalOpen = openFades.reduce((sum, f) => sum + f.stake, 0);
  const totalLocked = lockedFades.reduce((sum, f) => sum + f.stake, 0);

  const FadeCard = ({ fade, showActions = false }: { fade: FadeRecord; showActions?: boolean }) => {
    const gameTime = new Date(fade.game_commence_time);
    const isGamePast = isPast(gameTime);
    const hasScores = fade.final_score_home !== null && fade.final_score_away !== null;
    
    // Determine game status message
    const getGameStatus = () => {
      if (fade.status === 'settled') return null;
      if (hasScores) return `Final: ${fade.away_team} ${fade.final_score_away} - ${fade.home_team} ${fade.final_score_home}`;
      if (isGamePast) return '⏳ Awaiting final score...';
      return `Game: ${format(gameTime, 'MMM d, h:mm a')}`;
    };
    
    // Get user's position description
    const getUserPosition = () => {
      if (fade.is_poster) {
        return fade.line_description;
      }
      // Accepter takes opposite position
      if (fade.fade_type === 'over') return fade.line_description.replace('Over', 'Under');
      if (fade.fade_type === 'under') return fade.line_description.replace('Under', 'Over');
      if (fade.fade_type === 'spread') {
        // Flip the spread sign
        const spreadMatch = fade.line_description.match(/([+-]?\d+\.?\d*)/);
        if (spreadMatch) {
          const spread = parseFloat(spreadMatch[1]);
          return fade.line_description.replace(spreadMatch[1], (spread * -1 > 0 ? '+' : '') + (spread * -1).toString());
        }
      }
      return `Against: ${fade.line_description}`;
    };
    
    return (
      <Card className={cn(
        "p-4 border-2",
        fade.status === 'settled' && fade.is_winner ? "border-green-500/30 bg-green-500/5" :
        fade.status === 'settled' && fade.is_winner === false ? "border-red-500/30 bg-red-500/5" :
        fade.status === 'locked' && isGamePast ? "border-amber-500/30 bg-amber-500/5" :
        fade.status === 'locked' ? "border-primary/30 bg-primary/5" :
        fade.status === 'expired' ? "border-muted opacity-60" :
        "border-border"
      )}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">{fade.huddle_name}</span>
          <span className={cn(
            "text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1",
            fade.status === 'open' ? "bg-amber-500/20 text-amber-400" :
            fade.status === 'locked' && isGamePast ? "bg-amber-500/20 text-amber-400" :
            fade.status === 'locked' ? "bg-primary/20 text-primary" :
            fade.status === 'settled' && fade.is_winner ? "bg-green-500/20 text-green-400" :
            fade.status === 'settled' ? "bg-red-500/20 text-red-400" :
            "bg-muted text-muted-foreground"
          )}>
            {fade.status === 'open' ? 'Open' :
             fade.status === 'locked' && isGamePast ? '⏳ Pending' :
             fade.status === 'locked' ? '🔒 Locked' :
             fade.status === 'settled' && fade.is_winner ? '🏆 Won' :
             fade.status === 'settled' ? '❌ Lost' :
             'Expired'}
          </span>
        </div>

        {/* Matchup */}
        <div className="text-sm text-muted-foreground mb-1">
          {fade.away_team} @ {fade.home_team}
        </div>
        
        {/* Scores if available */}
        {hasScores && (
          <div className="text-sm font-semibold text-foreground mb-2 bg-muted/50 rounded px-2 py-1 inline-block">
            Final: {fade.final_score_away} - {fade.final_score_home}
          </div>
        )}
        
        {/* Game status for locked */}
        {fade.status === 'locked' && !hasScores && (
          <div className={cn(
            "text-xs mb-2",
            isGamePast ? "text-amber-400" : "text-muted-foreground"
          )}>
            {getGameStatus()}
          </div>
        )}

        {/* Your position */}
        <div className="mb-3">
          <p className="text-xs text-muted-foreground mb-0.5">Your pick:</p>
          <p className="text-foreground font-semibold">{getUserPosition()}</p>
        </div>

        {/* VS Display */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-xs font-bold text-primary">YOU</span>
            </div>
            <span className="text-sm font-medium">vs</span>
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
              <span className="text-xs font-bold">{fade.opponent_name.charAt(0).toUpperCase()}</span>
            </div>
            <span className="text-sm text-muted-foreground">{fade.opponent_name}</span>
          </div>
          <span className={cn(
            "text-lg font-bold",
            fade.status === 'settled' && fade.is_winner ? "text-green-500" :
            fade.status === 'settled' && fade.is_winner === false ? "text-red-500" :
            "text-primary"
          )}>
            {fade.status === 'settled' && fade.is_winner === false ? '-' : ''}${fade.stake}
          </span>
        </div>

        {showActions && fade.status === 'open' && (
          <Button
            size="sm"
            variant="outline"
            className="w-full mt-3"
            onClick={() => navigate(`/huddle/${fade.huddle_id}`)}
          >
            View in Huddle
          </Button>
        )}
      </Card>
    );
  };

  return (
    <div className="min-h-screen-dynamic bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 px-4 py-3 border-b border-border/30 bg-background/95 backdrop-blur-sm safe-area-inset-top">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="h-9 w-9 p-0 rounded-full"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">Fade Ledger</h1>
        </div>
      </div>

      {/* Cash Mode Status Banner */}
      {hasCashMode ? (
        <div className="mx-4 mt-4">
          <Card className="p-4 bg-gradient-to-r from-green-500/20 to-emerald-600/20 border-green-500/50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-500/30 flex items-center justify-center">
                <Check className="h-5 w-5 text-green-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-foreground flex items-center gap-2">
                  Cash Mode Active
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">PRO</span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  {venmoUsername ? (
                    <>Venmo: @{venmoUsername}</>
                  ) : (
                    <>Add your Venmo handle for easy settlement</>
                  )}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowVenmoSetup(true)}
                className="text-green-400 hover:text-green-300"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        </div>
      ) : (
        <div className="mx-4 mt-4">
          <Card 
            className="p-4 bg-gradient-to-r from-amber-500/20 to-amber-600/20 border-amber-500/50 cursor-pointer hover:border-amber-400 transition-colors"
            onClick={() => setShowCashModeModal(true)}
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-500/30 flex items-center justify-center">
                <Zap className="h-5 w-5 text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-foreground">Unlock Cash Mode</h3>
                <p className="text-xs text-muted-foreground">
                  Higher stakes • Venmo settlement • Private fades
                </p>
              </div>
              <DollarSign className="h-5 w-5 text-amber-400" />
            </div>
          </Card>
        </div>
      )}

      {/* Summary Cards */}
      <div className="px-4 py-4 grid grid-cols-3 gap-3">
        <Card className={cn(
          "p-3 text-center border-2",
          totalBalance > 0 ? "border-green-500/50 bg-green-500/10" :
          totalBalance < 0 ? "border-red-500/50 bg-red-500/10" :
          "border-border"
        )}>
          <p className="text-[10px] text-muted-foreground uppercase">Balance</p>
          <div className="flex items-center justify-center gap-1 mt-1">
            {totalBalance > 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : totalBalance < 0 ? (
              <TrendingDown className="h-4 w-4 text-red-500" />
            ) : null}
            <span className={cn(
              "text-xl font-black",
              totalBalance > 0 ? "text-green-500" :
              totalBalance < 0 ? "text-red-500" :
              "text-foreground"
            )}>
              {totalBalance > 0 ? '+' : ''}{totalBalance}
            </span>
          </div>
        </Card>

        <Card className="p-3 text-center border-amber-500/50 bg-amber-500/10">
          <p className="text-[10px] text-muted-foreground uppercase">Open</p>
          <div className="flex items-center justify-center gap-1 mt-1">
            <Clock className="h-4 w-4 text-amber-400" />
            <span className="text-xl font-black text-amber-400">${totalOpen}</span>
          </div>
          <p className="text-[10px] text-muted-foreground">{openFades.length} bet{openFades.length !== 1 ? 's' : ''}</p>
        </Card>

        <Card className="p-3 text-center border-primary/50 bg-primary/10">
          <p className="text-[10px] text-muted-foreground uppercase">Locked</p>
          <div className="flex items-center justify-center gap-1 mt-1">
            <Lock className="h-4 w-4 text-primary" />
            <span className="text-xl font-black text-primary">${totalLocked}</span>
          </div>
          <p className="text-[10px] text-muted-foreground">{lockedFades.length} bet{lockedFades.length !== 1 ? 's' : ''}</p>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="open" className="px-4">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="open" className="text-xs">
            Open ({openFades.length})
          </TabsTrigger>
          <TabsTrigger value="locked" className="text-xs">
            Locked ({lockedFades.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs">
            History
          </TabsTrigger>
          <TabsTrigger value="rivals" className="text-xs">
            Rivals
          </TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="mt-4 space-y-3">
          {openFades.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No open bets</p>
              <p className="text-xs">Post a fade in any huddle to get started</p>
            </div>
          ) : (
            openFades.map(fade => (
              <FadeCard key={fade.id} fade={fade} showActions />
            ))
          )}
        </TabsContent>

        <TabsContent value="locked" className="mt-4 space-y-3">
          {lockedFades.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Lock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No locked bets</p>
              <p className="text-xs">Locked bets are waiting for game results</p>
            </div>
          ) : (
            lockedFades.map(fade => (
              <FadeCard key={fade.id} fade={fade} />
            ))
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-3">
          {historyFades.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No history yet</p>
              <p className="text-xs">Completed and expired fades appear here</p>
            </div>
          ) : (
            historyFades.map(fade => (
              <FadeCard key={fade.id} fade={fade} />
            ))
          )}
        </TabsContent>

        <TabsContent value="rivals" className="mt-4 space-y-3">
          {ledgers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No rivalries yet</p>
              <p className="text-xs">Fade someone to start a rivalry!</p>
            </div>
          ) : (
            ledgers.map(ledger => (
              <Card key={ledger.id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{ledger.huddle_name}</span>
                  <span className={cn(
                    "text-lg font-bold",
                    ledger.net_points > 0 ? "text-green-500" :
                    ledger.net_points < 0 ? "text-red-500" :
                    "text-foreground"
                  )}>
                    {ledger.net_points > 0 ? '+' : ''}{ledger.net_points}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  vs {ledger.opponent_name}
                </p>
                <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                  <span>{ledger.total_fades} fades</span>
                  <span className="text-green-500">{ledger.user_a_wins}W</span>
                  <span className="text-red-500">{ledger.user_b_wins}L</span>
                </div>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Bottom padding for nav */}
      <div className="h-24" />

      {/* Cash Mode Upgrade Modal */}
      <CashModeUpgradeModal
        open={showCashModeModal}
        onOpenChange={setShowCashModeModal}
      />

      {/* Venmo Setup Modal */}
      <VenmoSetupModal
        open={showVenmoSetup}
        onOpenChange={setShowVenmoSetup}
      />
    </div>
  );
}
