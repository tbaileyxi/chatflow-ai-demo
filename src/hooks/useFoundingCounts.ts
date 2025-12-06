import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface FoundingCounts {
  charterCount: number;
  foundingCount: number;
  totalCount: number;
  charterRemaining: number;
  foundingRemaining: number;
  isExpired: boolean;
  isSoldOut: boolean;
  loading: boolean;
}

const OFFER_EXPIRY = new Date('2026-01-01T00:00:00Z');
const CHARTER_LIMIT = 100;
const FOUNDING_LIMIT = 200;

export function useFoundingCounts(): FoundingCounts {
  const [counts, setCounts] = useState({
    charterCount: 0,
    foundingCount: 0,
    totalCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCounts() {
      try {
        const { data, error } = await supabase.rpc('get_founding_counts');
        
        if (error) {
          console.error('Error fetching founding counts:', error);
          return;
        }

        if (data && data[0]) {
          setCounts({
            charterCount: Number(data[0].charter_count) || 0,
            foundingCount: Number(data[0].founding_count) || 0,
            totalCount: Number(data[0].total_count) || 0,
          });
        }
      } catch (err) {
        console.error('Error in useFoundingCounts:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchCounts();

    // Subscribe to profile changes for real-time updates
    const channel = supabase
      .channel('founding-counts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: 'founding_tier=neq.null'
        },
        () => {
          fetchCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const isExpired = new Date() >= OFFER_EXPIRY;
  const isSoldOut = counts.totalCount >= (CHARTER_LIMIT + FOUNDING_LIMIT);

  return {
    ...counts,
    charterRemaining: Math.max(0, CHARTER_LIMIT - counts.charterCount),
    foundingRemaining: Math.max(0, FOUNDING_LIMIT - counts.foundingCount),
    isExpired,
    isSoldOut,
    loading,
  };
}
