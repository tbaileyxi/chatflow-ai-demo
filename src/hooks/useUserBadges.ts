import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UserBadge {
  team_id: string;
  tier: 'basic' | 'superfan';
  team_name?: string;
  team_logo_url?: string;
}

// Global cache to avoid refetching for same users
const badgeCache = new Map<string, UserBadge | null>();

export function useUserBadges(userIds: string[]) {
  const [badges, setBadges] = useState<Record<string, UserBadge | null>>({});
  const fetchedRef = useRef(new Set<string>());

  const fetchBadges = useCallback(async (ids: string[]) => {
    // Filter out already fetched or cached
    const toFetch = ids.filter(id => !fetchedRef.current.has(id) && !badgeCache.has(id));
    
    if (toFetch.length === 0) {
      // Return cached values
      const cached: Record<string, UserBadge | null> = {};
      ids.forEach(id => {
        if (badgeCache.has(id)) {
          cached[id] = badgeCache.get(id) || null;
        }
      });
      if (Object.keys(cached).length > 0) {
        setBadges(prev => ({ ...prev, ...cached }));
      }
      return;
    }

    // Mark as being fetched
    toFetch.forEach(id => fetchedRef.current.add(id));

    const { data, error } = await supabase
      .from('user_badges')
      .select(`
        user_id,
        team_id,
        tier,
        teams:team_id (name, logo_url)
      `)
      .in('user_id', toFetch)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching user badges:', error);
      return;
    }

    const newBadges: Record<string, UserBadge | null> = {};
    
    // Set fetched badges
    (data || []).forEach((badge: any) => {
      const userBadge: UserBadge = {
        team_id: badge.team_id,
        tier: badge.tier,
        team_name: badge.teams?.name,
        team_logo_url: badge.teams?.logo_url
      };
      newBadges[badge.user_id] = userBadge;
      badgeCache.set(badge.user_id, userBadge);
    });

    // Mark users without badges as null
    toFetch.forEach(id => {
      if (!newBadges[id]) {
        newBadges[id] = null;
        badgeCache.set(id, null);
      }
    });

    setBadges(prev => ({ ...prev, ...newBadges }));
  }, []);

  useEffect(() => {
    if (userIds.length > 0) {
      fetchBadges(userIds);
    }
  }, [userIds.join(','), fetchBadges]);

  return badges;
}

// Hook for single user badge
export function useUserBadge(userId: string | undefined) {
  const badges = useUserBadges(userId ? [userId] : []);
  return userId ? badges[userId] : null;
}
