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
  is_premium: boolean;
  starting_chips: number;
  minimum_chips: number;
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
      setPortfolio({
        ...data,
        is_premium: (data as any).is_premium ?? false,
        starting_chips: (data as any).starting_chips ?? 1000,
        minimum_chips: (data as any).minimum_chips ?? 0,
      } as Portfolio);
    } else {
      const { data: newPortfolio } = await supabase
        .from('user_portfolios')
        .insert({ user_id: user.id, total_chips: 1000 })
        .select()
        .single();
      
      if (newPortfolio) {
        setPortfolio({
          ...newPortfolio,
          is_premium: false,
          starting_chips: 1000,
          minimum_chips: 0,
        } as Portfolio);
      }
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchPortfolio();
  }, [fetchPortfolio]);

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
          const d = payload.new as any;
          setPortfolio({
            ...d,
            is_premium: d.is_premium ?? false,
            starting_chips: d.starting_chips ?? 1000,
            minimum_chips: d.minimum_chips ?? 0,
          });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const startingChips = portfolio?.starting_chips ?? 1000;
  const minimumChips = portfolio?.minimum_chips ?? 0;
  const isPremium = portfolio?.is_premium ?? false;
  const isOutOfChips = portfolio ? portfolio.total_chips <= minimumChips : false;

  const winRate = portfolio && portfolio.total_bets > 0
    ? Math.round((portfolio.total_wins / portfolio.total_bets) * 100)
    : 0;

  const profit = portfolio ? portfolio.total_chips - startingChips : 0;

  return { portfolio, loading, winRate, profit, isPremium, minimumChips, isOutOfChips, startingChips, refetch: fetchPortfolio };
}
