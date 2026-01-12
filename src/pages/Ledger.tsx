import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, DollarSign, TrendingUp, TrendingDown, Clock, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

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

interface UnresolvedFade {
  id: string;
  huddle_id: string;
  huddle_name: string;
  line_description: string;
  stake: number;
  status: string;
  settlement_status: string;
  winner_id: string | null;
  is_winner: boolean;
  opponent_name: string;
  created_at: string;
}

export default function Ledger() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ledgers, setLedgers] = useState<LedgerEntry[]>([]);
  const [unresolvedFades, setUnresolvedFades] = useState<UnresolvedFade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    const fetchData = async () => {
      setLoading(true);

      // Fetch ledger entries where user is a participant
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

      // Fetch huddle names and opponent profiles
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

      // Fetch unresolved fades (settled but not paid_verified)
      const { data: fadesData } = await supabase
        .from('fades')
        .select('*')
        .or(`poster_id.eq.${user.id},accepter_id.eq.${user.id}`)
        .eq('status', 'settled')
        .neq('settlement_status', 'paid_verified')
        .order('settled_at', { ascending: false });

      if (fadesData && fadesData.length > 0) {
        const huddleIds = [...new Set(fadesData.map(f => f.huddle_id))];
        const opponentIds = fadesData.map(f => 
          f.poster_id === user.id ? f.accepter_id : f.poster_id
        ).filter(Boolean);

        const [{ data: huddles }, { data: profiles }] = await Promise.all([
          supabase.from('huddles').select('id, name').in('id', huddleIds),
          supabase.from('profiles').select('user_id, display_name, username').in('user_id', opponentIds as string[]),
        ]);

        const huddleMap = new Map(huddles?.map(h => [h.id, h.name]) || []);
        const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name || p.username || 'Anonymous']) || []);

        const formatted: UnresolvedFade[] = fadesData.map(f => ({
          id: f.id,
          huddle_id: f.huddle_id,
          huddle_name: huddleMap.get(f.huddle_id) || 'Unknown Huddle',
          line_description: f.line_description,
          stake: f.stake,
          status: f.status,
          settlement_status: (f as any).settlement_status || 'unpaid',
          winner_id: f.winner_id,
          is_winner: f.winner_id === user.id,
          opponent_name: profileMap.get(f.poster_id === user.id ? f.accepter_id! : f.poster_id) || 'Anonymous',
          created_at: f.created_at,
        }));

        setUnresolvedFades(formatted);
      }

      setLoading(false);
    };

    fetchData();
  }, [user, navigate]);

  if (!user) return null;

  const totalBalance = ledgers.reduce((sum, l) => sum + l.net_points, 0);

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

      {/* Overall Balance */}
      <div className="px-4 py-6">
        <Card className={cn(
          "p-6 text-center border-2",
          totalBalance > 0 ? "border-green-500/50 bg-green-500/10" :
          totalBalance < 0 ? "border-red-500/50 bg-red-500/10" :
          "border-border"
        )}>
          <p className="text-sm text-muted-foreground mb-1">Total Balance</p>
          <div className="flex items-center justify-center gap-2">
            {totalBalance > 0 ? (
              <TrendingUp className="h-6 w-6 text-green-500" />
            ) : totalBalance < 0 ? (
              <TrendingDown className="h-6 w-6 text-red-500" />
            ) : (
              <DollarSign className="h-6 w-6 text-muted-foreground" />
            )}
            <span className={cn(
              "text-4xl font-black",
              totalBalance > 0 ? "text-green-500" :
              totalBalance < 0 ? "text-red-500" :
              "text-foreground"
            )}>
              {totalBalance > 0 ? '+' : ''}{totalBalance}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Points across {ledgers.length} rivalry{ledgers.length !== 1 ? 's' : ''}
          </p>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pending" className="px-4">
        <TabsList className="w-full">
          <TabsTrigger value="pending" className="flex-1">
            <Clock className="h-4 w-4 mr-1" />
            Pending ({unresolvedFades.length})
          </TabsTrigger>
          <TabsTrigger value="balances" className="flex-1">
            <DollarSign className="h-4 w-4 mr-1" />
            Balances
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4 space-y-3">
          {unresolvedFades.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No pending settlements
            </div>
          ) : (
            unresolvedFades.map(fade => (
              <Card key={fade.id} className={cn(
                "p-4 border-2",
                fade.is_winner ? "border-green-500/30" : "border-red-500/30"
              )}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{fade.huddle_name}</span>
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded-full",
                    fade.settlement_status === 'paid_unverified' 
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {fade.settlement_status === 'paid_unverified' ? 'Awaiting Confirmation' : 'Unpaid'}
                  </span>
                </div>
                <p className="text-foreground font-medium mb-1">{fade.line_description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    vs {fade.opponent_name}
                  </span>
                  <span className={cn(
                    "text-lg font-bold",
                    fade.is_winner ? "text-green-500" : "text-red-500"
                  )}>
                    {fade.is_winner ? '+' : '-'}${fade.stake}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {format(new Date(fade.created_at), 'MMM d, yyyy')}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-3"
                  onClick={() => navigate(`/huddle/${fade.huddle_id}`)}
                >
                  Go to Huddle
                </Button>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="balances" className="mt-4 space-y-3">
          {ledgers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No fade history yet
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
    </div>
  );
}