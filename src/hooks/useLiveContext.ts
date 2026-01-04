import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type LiveMode = 'normal' | 'live' | 'cooldown';

export interface GameInfo {
  id: string;
  home_team: string;
  away_team: string;
  home_team_logo?: string;
  away_team_logo?: string;
  home_score: number | null;
  away_score: number | null;
  period?: string | null;
  clock?: string | null;
  status: string;
}

export interface SpecialEventInfo {
  id: string;
  name: string;
  subtitle?: string | null;
  network?: string | null;
}

export interface LiveContext {
  mode: LiveMode;
  game: GameInfo | null;
  special_event: SpecialEventInfo | null;
  is_home_team?: boolean;
  opponent_team_id?: string | null;
}

export function useLiveContext(roomId: string | undefined, teamId?: string | null) {
  const [context, setContext] = useState<LiveContext>({
    mode: 'normal',
    game: null,
    special_event: null
  });
  const [loading, setLoading] = useState(true);

  const fetchContext = useCallback(async () => {
    if (!roomId) {
      setLoading(false);
      return;
    }

    try {
      // Try to call the database function first
      const { data, error } = await supabase.rpc('get_room_live_context', {
        p_room_id: roomId
      });

      if (error) {
        console.error('Error fetching live context via RPC:', error);
        
        // Fallback: check teams_live_state directly if we have a teamId
        if (teamId) {
          const { data: liveState } = await supabase
            .from('teams_live_state')
            .select('*, games!active_game_id(*)')
            .eq('team_id', teamId)
            .maybeSingle();

          if (liveState && liveState.state !== 'normal') {
            const game = liveState.games as any;
            setContext({
              mode: liveState.state as LiveMode,
              game: game ? {
                id: game.id,
                home_team: game.home_team_id || '',
                away_team: game.away_team_id || '',
                home_score: game.home_score,
                away_score: game.away_score,
                period: game.period,
                clock: game.clock,
                status: game.status
              } : null,
              special_event: null,
              is_home_team: liveState.is_home_team,
              opponent_team_id: liveState.active_opponent_team_id
            });
            setLoading(false);
            return;
          }
        }

        setContext({ mode: 'normal', game: null, special_event: null });
        setLoading(false);
        return;
      }

      if (data) {
        // Parse the JSONB response
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        setContext({
          mode: parsed.mode || 'normal',
          game: parsed.game || null,
          special_event: parsed.special_event || null,
          is_home_team: parsed.is_home_team,
          opponent_team_id: parsed.opponent_team_id
        });
      }
    } catch (err) {
      console.error('Error in useLiveContext:', err);
    } finally {
      setLoading(false);
    }
  }, [roomId, teamId]);

  useEffect(() => {
    fetchContext();

    // Poll every 30 seconds when in live mode, otherwise every 2 minutes
    const interval = setInterval(fetchContext, context.mode === 'live' ? 30000 : 120000);

    return () => clearInterval(interval);
  }, [fetchContext, context.mode]);

  // Subscribe to realtime updates on teams_live_state
  useEffect(() => {
    if (!teamId) return;

    const channel = supabase
      .channel(`live_state_${teamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'teams_live_state',
          filter: `team_id=eq.${teamId}`
        },
        () => {
          // Refresh context when state changes
          fetchContext();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, fetchContext]);

  return { context, loading, refetch: fetchContext };
}

// Helper to get pulse drop frequency based on mode
export function getPulseFrequency(mode: LiveMode): { min: number; max: number } {
  switch (mode) {
    case 'live':
      return { min: 3, max: 8 }; // 3-8 minutes
    case 'cooldown':
      return { min: 5, max: 15 }; // 5-15 minutes
    default:
      return { min: 10, max: 30 }; // 10-30 minutes
  }
}

// Helper to get status display text
export function getStatusDisplay(context: LiveContext): string {
  if (context.mode === 'live') {
    if (context.game?.period) {
      return context.game.period;
    }
    return 'LIVE';
  }
  if (context.mode === 'cooldown') {
    return 'FINAL';
  }
  return '';
}
