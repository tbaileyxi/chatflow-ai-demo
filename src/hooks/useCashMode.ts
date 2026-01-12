import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useCashMode() {
  const { user } = useAuth();
  const [hasCashMode, setHasCashMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [venmoUsername, setVenmoUsername] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setHasCashMode(false);
      setLoading(false);
      return;
    }

    const checkCashMode = async () => {
      const { data, error } = await supabase
        .from('cash_mode_subscriptions')
        .select('status, expires_at, venmo_username')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (data && new Date(data.expires_at) > new Date()) {
        setHasCashMode(true);
        setVenmoUsername(data.venmo_username);
      } else {
        setHasCashMode(false);
        setVenmoUsername(null);
      }
      setLoading(false);
    };

    checkCashMode();

    // Subscribe to changes
    const channel = supabase
      .channel(`cash-mode-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'cash_mode_subscriptions',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        checkCashMode();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { hasCashMode, loading, venmoUsername };
}