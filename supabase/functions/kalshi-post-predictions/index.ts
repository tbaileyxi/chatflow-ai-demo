import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find unposted, unresolved markets closing within the next 48 hours.
    const now = new Date();
    // OFF by default. This posted EVERY unposted market (limit 500) into chat,
    // hourly through game hours, on top of the fade cards — which is why one
    // room showed "Over 7.5 · YES 51c/NO 49c" AND "FADE Total 7.5 · Over/Under"
    // for the same line, plus a carousel of strikes nobody asked for.
    //
    // The fade card already carries this market and is actionable; a price card
    // beside it is the same bet twice in two vocabularies. The full board
    // belongs in Picks, not in a conversation.
    //
    // PREDICTION_CARDS_ENABLED=true brings them back with no deploy.
    if ((Deno.env.get("PREDICTION_CARDS_ENABLED") || "false").toLowerCase() !== "true") {
      return new Response(JSON.stringify({ posted: 0, skipped: "prediction cards disabled" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cutoff48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const { data: markets } = await supabase
      .from('kalshi_markets')
      .select('*')
      .is('posted_at', null)
      .eq('is_resolved', false)
      .not('team_id', 'is', null)
      .gte('event_start_time', now.toISOString())
      .lte('event_start_time', cutoff48h.toISOString())
      .order('event_start_time', { ascending: true })
      .limit(500);

    if (!markets || markets.length === 0) {
      return new Response(JSON.stringify({ posted: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Group markets by team
    const byTeam = new Map<string, typeof markets>();
    for (const m of markets) {
      if (!m.team_id) continue;
      const existing = byTeam.get(m.team_id) || [];
      existing.push(m);
      byTeam.set(m.team_id, existing);
    }

    // Get system user
    const { data: systemUserId } = await supabase.rpc('get_or_create_system_user');
    if (!systemUserId) throw new Error('Failed to get system user');

    let posted = 0;

    for (const [teamId, teamMarkets] of byTeam.entries()) {
      // Cards drop INLINE in every room attached to the team — crew rooms
      // included, not just the official community. The chat is the surface;
      // there is no pinned predictions section in the app anymore.
      const { data: huddles } = await supabase
        .from('huddles')
        .select('id')
        .eq('team_id', teamId);

      if (!huddles || huddles.length === 0) continue;

      // Compact card carousel: up to 3 markets. Odds-API team markets carry a
      // sort_weight (winner/spread/total) so the card shows real variety, not
      // three flavors of the same moneyline; Kalshi markets fall back to volume.
      const rank = (m: any) =>
        ((m.metadata as any)?.sort_weight || 0) * 1_000_000 + ((m.metadata as any)?.volume || 0);
      const topMarkets = teamMarkets
        .sort((a, b) => rank(b) - rank(a))
        .slice(0, 3);

      const marketIds = topMarkets.map(m => m.id);
      const content = JSON.stringify({ market_ids: marketIds });

      const { error: msgError } = await supabase
        .from('huddle_messages')
        .insert(
          huddles.map((h) => ({
            huddle_id: h.id,
            user_id: systemUserId,
            content,
            message_type: 'prediction_card',
            is_bot_message: true,
          })),
        );

      if (!msgError) {
        // Mark markets as posted so the next cron tick doesn't re-drop them.
        for (const m of topMarkets) {
          await supabase
            .from('kalshi_markets')
            .update({ posted_at: now.toISOString(), huddle_id: huddles[0].id })
            .eq('id', m.id);
        }
        posted += topMarkets.length;
      }
    }

    return new Response(JSON.stringify({ posted }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('kalshi-post-predictions error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
