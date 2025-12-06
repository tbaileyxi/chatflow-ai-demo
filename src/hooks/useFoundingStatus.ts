import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface FoundingStatus {
  isFoundingMember: boolean;
  foundingTier: 'charter' | 'founding' | null;
  spotNumber: number | null;
  promoCode: string | null;
  hasLifetimeVerifiedCode: boolean;
  loading: boolean;
}

export function useFoundingStatus(): FoundingStatus {
  const { user } = useAuth();
  const [status, setStatus] = useState<FoundingStatus>({
    isFoundingMember: false,
    foundingTier: null,
    spotNumber: null,
    promoCode: null,
    hasLifetimeVerifiedCode: false,
    loading: true,
  });

  useEffect(() => {
    async function fetchStatus() {
      if (!user?.id) {
        setStatus(prev => ({ ...prev, loading: false }));
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('is_founding_member, founding_tier, founding_spot_number, verified_huddle_promo_code, has_lifetime_verified_huddle_code')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Error fetching founding status:', error);
          return;
        }

        if (data) {
          setStatus({
            isFoundingMember: data.is_founding_member || false,
            foundingTier: data.founding_tier as 'charter' | 'founding' | null,
            spotNumber: data.founding_spot_number,
            promoCode: data.verified_huddle_promo_code,
            hasLifetimeVerifiedCode: data.has_lifetime_verified_huddle_code || false,
            loading: false,
          });
        }
      } catch (err) {
        console.error('Error in useFoundingStatus:', err);
        setStatus(prev => ({ ...prev, loading: false }));
      }
    }

    fetchStatus();
  }, [user?.id]);

  return status;
}
