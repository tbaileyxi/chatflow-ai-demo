import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, TrendingUp, TrendingDown, Clock, ExternalLink, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface LedgerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  huddleId?: string;
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

export const LedgerModal: React.FC<LedgerModalProps> = ({
  open,
  onOpenChange,
  huddleId,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [unresolvedFades, setUnresolvedFades] = useState<UnresolvedFade[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !user) return;

    const fetchData = async () => {
      setLoading(true);

      // Fetch ledger entries where user is a participant
      let ledgerQuery = supabase
        .from('fade_ledgers')
        .select('net_points, user_a_id')
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`);
      
      if (huddleId) {
        ledgerQuery = ledgerQuery.eq('huddle_id', huddleId);
      }

      const { data: ledgerData } = await ledgerQuery;
      
      if (ledgerData) {
        const balance = ledgerData.reduce((sum, l) => {
          return sum + (l.user_a_id === user.id ? l.net_points : -l.net_points);
        }, 0);
        setTotalBalance(balance);
      }

      // Fetch unresolved fades
      let fadesQuery = supabase
        .from('fades')
        .select('*')
        .or(`poster_id.eq.${user.id},accepter_id.eq.${user.id}`)
        .eq('status', 'settled')
        .neq('settlement_status', 'paid_verified')
        .order('settled_at', { ascending: false });

      if (huddleId) {
        fadesQuery = fadesQuery.eq('huddle_id', huddleId);
      }

      const { data: fadesData } = await fadesQuery;

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
      } else {
        setUnresolvedFades([]);
      }

      setLoading(false);
    };

    fetchData();
  }, [open, user, huddleId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Fade Ledger
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Balance Summary */}
            <Card className={cn(
              "p-4 text-center border-2",
              totalBalance > 0 ? "border-green-500/50 bg-green-500/10" :
              totalBalance < 0 ? "border-red-500/50 bg-red-500/10" :
              "border-border"
            )}>
              <p className="text-xs text-muted-foreground mb-1">Balance</p>
              <div className="flex items-center justify-center gap-2">
                {totalBalance > 0 ? (
                  <TrendingUp className="h-5 w-5 text-green-500" />
                ) : totalBalance < 0 ? (
                  <TrendingDown className="h-5 w-5 text-red-500" />
                ) : (
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                )}
                <span className={cn(
                  "text-2xl font-black",
                  totalBalance > 0 ? "text-green-500" :
                  totalBalance < 0 ? "text-red-500" :
                  "text-foreground"
                )}>
                  {totalBalance > 0 ? '+' : ''}${totalBalance}
                </span>
              </div>
            </Card>

            {/* Pending Settlements */}
            <div className="space-y-3 mt-4">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Pending Settlements ({unresolvedFades.length})
              </h3>

              {unresolvedFades.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No pending settlements
                </div>
              ) : (
                unresolvedFades.slice(0, 5).map(fade => (
                  <Card key={fade.id} className={cn(
                    "p-3 border",
                    fade.is_winner ? "border-green-500/30" : "border-red-500/30"
                  )}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">{fade.huddle_name}</span>
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full",
                        fade.settlement_status === 'paid_unverified' 
                          ? "bg-amber-500/20 text-amber-400"
                          : "bg-muted text-muted-foreground"
                      )}>
                        {fade.settlement_status === 'paid_unverified' ? 'Awaiting' : 'Unpaid'}
                      </span>
                    </div>
                    <p className="text-sm font-medium mb-1 truncate">{fade.line_description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        vs {fade.opponent_name}
                      </span>
                      <span className={cn(
                        "font-bold",
                        fade.is_winner ? "text-green-500" : "text-red-500"
                      )}>
                        {fade.is_winner ? '+' : '-'}${fade.stake}
                      </span>
                    </div>
                  </Card>
                ))
              )}
            </div>

            {/* Full Ledger Link */}
            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={() => {
                onOpenChange(false);
                navigate('/ledger');
              }}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View Full Ledger
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};