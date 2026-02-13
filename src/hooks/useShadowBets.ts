import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ShadowBet {
  id: string;
  user_id: string;
  market_id: string;
  huddle_id: string;
  position: string;
  chips_risked: number;
  potential_payout: number;
  placed_at: string;
  is_settled: boolean;
  won: boolean | null;
  chips_won: number;
  market?: {
    id: string;
    question: string;
    current_yes_price: number;
    market_type: string;
    event_start_time: string;
    is_resolved: boolean;
    resolution: string | null;
    kalshi_ticker: string;
  };
}

export function useShadowBets(huddleId?: string) {
  const { user } = useAuth();
  const [bets, setBets] = useState<ShadowBet[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBets = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    let query = supabase
      .from('shadow_bets')
      .select(`
        *,
        market:kalshi_markets(id, question, current_yes_price, market_type, event_start_time, is_resolved, resolution, kalshi_ticker)
      `)
      .eq('user_id', user.id)
      .order('placed_at', { ascending: false });

    if (huddleId) {
      query = query.eq('huddle_id', huddleId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching shadow bets:', error);
    } else {
      setBets((data || []) as unknown as ShadowBet[]);
    }
    setLoading(false);
  }, [user, huddleId]);

  useEffect(() => {
    fetchBets();
  }, [fetchBets]);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`shadow-bets-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'shadow_bets',
        filter: `user_id=eq.${user.id}`
      }, () => {
        fetchBets();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchBets]);

  const openBets = bets.filter(b => !b.is_settled && b.market && !b.market.is_resolved && new Date(b.market.event_start_time) > new Date());
  const pendingBets = bets.filter(b => !b.is_settled && b.market && (b.market.is_resolved || new Date(b.market.event_start_time) <= new Date()));
  const closedBets = bets.filter(b => b.is_settled);

  return { bets, openBets, pendingBets, closedBets, loading, refetch: fetchBets };
}
