import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Scheduled function: runs every 10 minutes during live games, 30 minutes otherwise
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Find all active rooms (huddles with event names or recent activity)
    const { data: liveEvents } = await supabase
      .from('live_events')
      .select('id, name, team1_id, team2_id, status')
      .in('status', ['live', 'upcoming']);

    // Find huddles that were created for events
    const { data: eventHuddles } = await supabase
      .from('huddles')
      .select('id, name, team_id')
      .like('name', 'Event:%');

    // Get team names for context
    const teamIds = new Set<string>();
    liveEvents?.forEach(e => {
      if (e.team1_id) teamIds.add(e.team1_id);
      if (e.team2_id) teamIds.add(e.team2_id);
    });
    eventHuddles?.forEach(h => {
      if (h.team_id) teamIds.add(h.team_id);
    });

    const { data: teams } = await supabase
      .from('teams')
      .select('id, name')
      .in('id', Array.from(teamIds));

    const teamMap = new Map<string, string>();
    teams?.forEach(t => teamMap.set(t.id, t.name));

    // Trigger pulse drops for each active event huddle
    let dropsTriggered = 0;
    
    for (const huddle of eventHuddles || []) {
      // Check if this huddle's event is live
      const isLive = liveEvents?.some(e => 
        huddle.name.includes(e.name) && e.status === 'live'
      ) || false;

      const teamName = teamMap.get(huddle.team_id) || '';
      
      // Call the pulse-drop function
      try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/pulse-drop`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
          },
          body: JSON.stringify({
            huddle_id: huddle.id,
            team_id: huddle.team_id,
            team_name: teamName,
            is_live: isLive
          })
        });

        if (response.ok) {
          dropsTriggered++;
        }
      } catch (err) {
        console.error(`Error triggering pulse drop for ${huddle.id}:`, err);
      }
    }

    console.log(`Pulse scheduler complete: ${dropsTriggered} drops triggered`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        huddles_processed: eventHuddles?.length || 0,
        drops_triggered: dropsTriggered
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Pulse scheduler error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
