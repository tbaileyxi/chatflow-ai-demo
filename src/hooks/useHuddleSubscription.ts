import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface SubscriptionStatus {
  is_verified: boolean;
  expires_at: string | null;
  status: string;
}

export const useHuddleSubscription = (huddleId: string) => {
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const fetchSubscriptionStatus = async () => {
      if (!user || !huddleId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Use the secure function to get subscription status without exposing sensitive payment data
        const { data, error: rpcError } = await supabase
          .rpc('get_huddle_subscription_status', { 
            target_huddle_id: huddleId 
          });

        if (rpcError) {
          // If user doesn't own the huddle, they shouldn't see subscription details
          if (rpcError.message.includes('Access denied')) {
            setSubscriptionStatus({
              is_verified: false,
              expires_at: null,
              status: 'no_access'
            });
          } else {
            throw rpcError;
          }
        } else {
          setSubscriptionStatus(data?.[0] || {
            is_verified: false,
            expires_at: null,
            status: 'inactive'
          });
        }
      } catch (err) {
        console.error('Error fetching subscription status:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch subscription status');
        setSubscriptionStatus({
          is_verified: false,
          expires_at: null,
          status: 'error'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSubscriptionStatus();
  }, [user, huddleId]);

  const refreshSubscriptionStatus = () => {
    const fetchSubscriptionStatus = async () => {
      if (!user || !huddleId) return;

      try {
        setError(null);
        const { data, error: rpcError } = await supabase
          .rpc('get_huddle_subscription_status', { 
            target_huddle_id: huddleId 
          });

        if (rpcError) {
          if (rpcError.message.includes('Access denied')) {
            setSubscriptionStatus({
              is_verified: false,
              expires_at: null,
              status: 'no_access'
            });
          } else {
            throw rpcError;
          }
        } else {
          setSubscriptionStatus(data?.[0] || {
            is_verified: false,
            expires_at: null,
            status: 'inactive'
          });
        }
      } catch (err) {
        console.error('Error refreshing subscription status:', err);
        setError(err instanceof Error ? err.message : 'Failed to refresh subscription status');
      }
    };

    fetchSubscriptionStatus();
  };

  return {
    subscriptionStatus,
    loading,
    error,
    refreshSubscriptionStatus
  };
};