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
      // Find official huddle for this team
      const { data: huddle } = await supabase
        .from('huddles')
        .select('id')
        .eq('team_id', teamId)
        .eq('is_official_team_huddle', true)
        .maybeSingle();

      if (!huddle) continue;

      // Take top 5-8 markets (sorted by volume if available)
      const topMarkets = teamMarkets
        .sort((a, b) => ((b.metadata as any)?.volume || 0) - ((a.metadata as any)?.volume || 0))
        .slice(0, 8);

      const marketIds = topMarkets.map(m => m.id);

      // Post prediction card message
      const { error: msgError } = await supabase
        .from('huddle_messages')
        .insert({
          huddle_id: huddle.id,
          user_id: systemUserId,
          content: JSON.stringify({ market_ids: marketIds }),
          message_type: 'prediction_card',
          is_bot_message: true,
        });

      if (!msgError) {
        // Mark markets as posted and link to huddle
        for (const m of topMarkets) {
          await supabase
            .from('kalshi_markets')
            .update({ posted_at: now.toISOString(), huddle_id: huddle.id })
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
