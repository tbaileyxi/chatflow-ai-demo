import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Portfolio {
  user_id: string;
  total_chips: number;
  total_bets: number;
  total_wins: number;
  total_losses: number;
  last_reset_at: string;
}

export function usePortfolio() {
  const { user } = useAuth();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPortfolio = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('user_portfolios')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching portfolio:', error);
    }

    if (data) {
      setPortfolio(data as Portfolio);
    } else {
      // Create default portfolio
      const { data: newPortfolio } = await supabase
        .from('user_portfolios')
        .insert({ user_id: user.id, total_chips: 1000 })
        .select()
        .single();
      
      if (newPortfolio) {
        setPortfolio(newPortfolio as Portfolio);
      }
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchPortfolio();
  }, [fetchPortfolio]);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`portfolio-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_portfolios',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        if (payload.new) {
          setPortfolio(payload.new as Portfolio);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const winRate = portfolio && portfolio.total_bets > 0
    ? Math.round((portfolio.total_wins / portfolio.total_bets) * 100)
    : 0;

  const profit = portfolio ? portfolio.total_chips - 1000 : 0;

  return { portfolio, loading, winRate, profit, refetch: fetchPortfolio };
}
