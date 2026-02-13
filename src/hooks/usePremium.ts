import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface PremiumStatus {
  isPremium: boolean;
  premiumSince: string | null;
  premiumExpiresAt: string | null;
  loading: boolean;
}

export function usePremium(): PremiumStatus {
  const { user } = useAuth();
  const [isPremium, setIsPremium] = useState(false);
  const [premiumSince, setPremiumSince] = useState<string | null>(null);
  const [premiumExpiresAt, setPremiumExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetch = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('is_premium, premium_since, premium_expires_at')
        .eq('user_id', user.id)
        .single();

      if (data) {
        // Check grace period
        const isActive = data.is_premium && 
          (!data.premium_expires_at || new Date(data.premium_expires_at) > new Date());
        setIsPremium(isActive);
        setPremiumSince(data.premium_since);
        setPremiumExpiresAt(data.premium_expires_at);
      }
      setLoading(false);
    };

    fetch();

    // Real-time
    const channel = supabase
      .channel(`premium-${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        const p = payload.new as any;
        const isActive = p.is_premium && 
          (!p.premium_expires_at || new Date(p.premium_expires_at) > new Date());
        setIsPremium(isActive);
        setPremiumSince(p.premium_since);
        setPremiumExpiresAt(p.premium_expires_at);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return { isPremium, premiumSince, premiumExpiresAt, loading };
}
