import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const BATCH_SIZE = 5;
const CONCURRENCY_CAP = 4;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check endpoint
  const url = new URL(req.url);
  if (url.searchParams.get('health') === '1') {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: stateRow } = await supabase.from('pulse_scheduler_state').select('*').eq('id', '00000000-0000-0000-0000-000000000001').single();
    return new Response(JSON.stringify({
      ok: true,
      last_cursor: stateRow?.cursor_index ?? 0,
      limit_default: BATCH_SIZE,
      last_run_at: stateRow?.updated_at ?? null
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Cron secret auth
  const CRON_SECRET = Deno.env.get('CRON_SECRET');
  const providedSecret = req.headers.get('x-cron-secret');
  if (CRON_SECRET && providedSecret !== CRON_SECRET) {
    console.error('[pulse-scheduler] 401 - invalid cron secret');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Read current cursor
    const { data: stateRow, error: stateErr } = await supabase
      .from('pulse_scheduler_state')
      .select('cursor_index')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .single();

    let cursorIndex = stateRow?.cursor_index ?? 0;

    // 2. Fetch all eligible huddles (team huddles + event huddles)
    const { data: allHuddles } = await supabase
      .from('huddles')
      .select('id, name, team_id, event_id, is_private')
      .or('team_id.not.is.null,event_id.not.is.null')
      .order('created_at', { ascending: true });

    const huddles = allHuddles || [];
    if (huddles.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No huddles to process', drops_triggered: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Wrap cursor if it exceeds list length
    if (cursorIndex >= huddles.length) {
      cursorIndex = 0;
    }

    // 3. Select batch starting from cursor
    const batch = huddles.slice(cursorIndex, cursorIndex + BATCH_SIZE);
    const nextCursor = (cursorIndex + batch.length) % huddles.length;

    // 4. Get team names for context
    const teamIds = [...new Set(batch.map(h => h.team_id).filter(Boolean))];
    let teamMap = new Map<string, string>();
    if (teamIds.length > 0) {
      const { data: teams } = await supabase.from('teams').select('id, name').in('id', teamIds);
      teams?.forEach(t => teamMap.set(t.id, t.name));
    }

    // 5. Get teams_live_state for batch team IDs
    let liveStateMap = new Map<string, boolean>();
    if (teamIds.length > 0) {
      const { data: liveStates } = await supabase
        .from('teams_live_state')
        .select('team_id, state')
        .in('team_id', teamIds);
      liveStates?.forEach(ls => liveStateMap.set(ls.team_id, ls.state === 'live'));
    }

    // 6. Build payloads
    interface DropPayload {
      huddle_id: string;
      team_id?: string;
      team_name?: string;
      is_live: boolean;
      event_id?: string;
    }

    const payloads: DropPayload[] = batch.map(h => ({
      huddle_id: h.id,
      team_id: h.team_id || undefined,
      team_name: h.team_id ? teamMap.get(h.team_id) || '' : undefined,
      is_live: h.team_id ? liveStateMap.get(h.team_id) || false : false,
      event_id: h.event_id || undefined,
    }));

    // 7. Fan-out for events: also post into both teams' main huddles
    const { data: liveEvents } = await supabase
      .from('live_events')
      .select('id, team1_id, team2_id')
      .in('status', ['live', 'upcoming']);

    const eventTeamMap = new Map<string, { t1?: string; t2?: string }>();
    liveEvents?.forEach(e => eventTeamMap.set(e.id, { t1: e.team1_id, t2: e.team2_id }));

    for (const h of batch) {
      if (h.event_id && eventTeamMap.has(h.event_id)) {
        const { t1, t2 } = eventTeamMap.get(h.event_id)!;
        // Find team main huddles
        for (const tid of [t1, t2].filter(Boolean) as string[]) {
          const { data: teamHuddle } = await supabase
            .from('huddles')
            .select('id')
            .eq('team_id', tid)
            .eq('is_official_team_huddle', true)
            .limit(1)
            .maybeSingle();
          if (teamHuddle && !payloads.find(p => p.huddle_id === teamHuddle.id)) {
            payloads.push({
              huddle_id: teamHuddle.id,
              team_id: tid,
              team_name: teamMap.get(tid) || '',
              is_live: liveStateMap.get(tid) || false,
              event_id: h.event_id,
            });
          }
        }
      }
    }

    // 8. Call pulse-drop in batches with concurrency cap
    let dropsTriggered = 0;
    const triggerDrop = async (payload: DropPayload) => {
      try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/pulse-drop`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
          },
          body: JSON.stringify(payload)
        });
        if (response.ok) dropsTriggered++;
        else console.error('[pulse-scheduler] pulse-drop error:', response.status);
      } catch (err) {
        console.error('[pulse-scheduler] pulse-drop fetch error:', err);
      }
    };

    // Process in groups of CONCURRENCY_CAP
    for (let i = 0; i < payloads.length; i += CONCURRENCY_CAP) {
      const chunk = payloads.slice(i, i + CONCURRENCY_CAP);
      await Promise.allSettled(chunk.map(triggerDrop));
    }

    // 9. Update cursor
    await supabase
      .from('pulse_scheduler_state')
      .update({ cursor_index: nextCursor, updated_at: new Date().toISOString() })
      .eq('id', '00000000-0000-0000-0000-000000000001');

    console.log(`[pulse-scheduler] Complete: ${dropsTriggered} drops triggered, next cursor ${nextCursor}`);

    return new Response(
      JSON.stringify({ success: true, huddles_processed: batch.length, drops_triggered: dropsTriggered, next_cursor: nextCursor }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[pulse-scheduler] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
