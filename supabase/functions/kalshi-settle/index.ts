import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const KALSHI_BASE = 'https://api.elections.kalshi.com/trade-api/v2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find unresolved markets past their event time
    const { data: unresolvedMarkets } = await supabase
      .from('kalshi_markets')
      .select('id, kalshi_ticker, huddle_id, question, current_yes_price, event_start_time')
      .eq('is_resolved', false)
      .lt('event_start_time', new Date().toISOString());

    if (!unresolvedMarkets || unresolvedMarkets.length === 0) {
      return new Response(JSON.stringify({ settled: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let totalSettled = 0;
    let voided = 0;

    // Track settled markets per huddle for consolidated summaries
    const huddleResults: Map<string, {
      markets: Array<{ question: string; resolution: string; yesPrice: number }>;
      betsSettled: number;
    }> = new Map();

    // Check each market against Kalshi
    for (const market of unresolvedMarkets) {
      try {
        // SGO rows live in this table too but grade through odds-settle.
        // Asking Kalshi about them is a guaranteed 404.
        if (String(market.kalshi_ticker).startsWith('sgo:')) continue;

        // Game-level totals fan out to both teams' rooms, and each row needs a
        // unique kalshi_ticker, so they carry a ":<team-id-prefix>" suffix.
        // Kalshi knows nothing about that suffix — looking it up 404s and the
        // market never settles. Strip it before asking.
        const realTicker = String(market.kalshi_ticker).replace(/:[0-9a-f]{8}$/i, '');
        const url = `${KALSHI_BASE}/markets/${realTicker}`;
        const response = await fetch(url, {
          headers: { 'Accept': 'application/json' },
        });

        if (!response.ok) continue;

        const data = await response.json();
        const kalshiMarket = data.market;

        // Kalshi marks resolved markets status 'finalized' (and sometimes
        // 'settled'). Accept either.
        //
        // The outcome is NOT always yes/no. Game markets finalize with
        // result:'scalar' and the payout in settlement_value_dollars, so the
        // old yes/no-only check skipped every one and 72 markets sat open —
        // the oldest for 59 days.
        //
        // The middle band is a VOID, not a loss: a cancelled or refunded
        // market pays out at the prevailing price (SF $0.43 / ATL $0.57 on the
        // same game). Grading those as losses would take chips from people
        // whose market Kalshi simply cancelled.
        if (!kalshiMarket) continue;
        const statusOk =
          kalshiMarket.status === 'settled' || kalshiMarket.status === 'finalized';
        if (!statusOk) continue;

        let outcome: 'YES' | 'NO' | 'VOID' | null = null;
        if (kalshiMarket.result === 'yes') outcome = 'YES';
        else if (kalshiMarket.result === 'no') outcome = 'NO';
        else if (kalshiMarket.result === 'scalar') {
          const v = parseFloat(kalshiMarket.settlement_value_dollars ?? '');
          if (Number.isFinite(v)) {
            outcome = v >= 0.99 ? 'YES' : v <= 0.01 ? 'NO' : 'VOID';
          }
        }
        if (!outcome) continue;

        // A void closes the market so it stops showing, but grades nobody.
        if (outcome === 'VOID') {
          await supabase
            .from('kalshi_markets')
            .update({ is_resolved: true, resolution: null })
            .eq('id', market.id);
          voided++;
          continue;
        }

        const resolution = outcome;

        // Settle bets
        const { data: settledCount } = await supabase.rpc('settle_shadow_bets', {
          p_market_id: market.id,
          p_resolution: resolution,
        });

        // Mark the market resolved so it leaves the open-markets list and
        // doesn't get re-checked every run.
        await supabase
          .from('kalshi_markets')
          .update({ is_resolved: true, resolution })
          .eq('id', market.id);

        totalSettled += (settledCount || 0);

        // Track for huddle summary
        if (market.huddle_id) {
          if (!huddleResults.has(market.huddle_id)) {
            huddleResults.set(market.huddle_id, { markets: [], betsSettled: 0 });
          }
          // Do NOT headline a "Post-Game Summary" while the game is still on.
          // Kalshi finalizes a total the instant it is mathematically decided —
          // "Over 2.5 runs" settles in the 3rd — so grading it immediately is
          // correct, but announcing a post-game recap in the 5th is not. Hold
          // the recap until the game has plausibly ended. Grading above is
          // unaffected; only the summary waits.
          const startedMs = market.event_start_time
            ? Date.parse(market.event_start_time) : 0;
          const GAME_OVER_AFTER_MS = 4 * 60 * 60 * 1000;
          if (!startedMs || Date.now() - startedMs < GAME_OVER_AFTER_MS) {
            continue;
          }

          const entry = huddleResults.get(market.huddle_id)!;
          entry.markets.push({
            question: market.question,
            resolution,
            yesPrice: market.current_yes_price || 50,
          });
          entry.betsSettled += (settledCount || 0);
        }
      } catch (err) {
        console.error(`Error settling market ${market.kalshi_ticker}:`, err);
      }
    }

    // Post consolidated game summaries per huddle
    for (const [huddleId, result] of huddleResults.entries()) {
      if (result.markets.length === 0) continue;

      try {
        // Get bet stats for this huddle's settled markets
        const marketQuestions = result.markets.map(m => m.question);
        
        // Query settled bets for these markets in this huddle
        const { data: settledBets } = await supabase
          .from('shadow_bets')
          .select('user_id, position, chips_risked, chips_won, won, market:kalshi_markets!inner(question, huddle_id)')
          .eq('is_settled', true)
          .eq('market.huddle_id', huddleId);

        // Filter to only bets from the markets we just settled
        const relevantBets = (settledBets || []).filter((b: any) => 
          marketQuestions.includes(b.market?.question)
        );

        const totalBets = relevantBets.length;
        const correctBets = relevantBets.filter((b: any) => b.won === true).length;
        const accuracy = totalBets > 0 ? Math.round((correctBets / totalBets) * 100) : 0;

        // Find top predictor
        const userStats: Map<string, { wins: number; profit: number }> = new Map();
        for (const bet of relevantBets) {
          const uid = (bet as any).user_id;
          if (!userStats.has(uid)) userStats.set(uid, { wins: 0, profit: 0 });
          const s = userStats.get(uid)!;
          if ((bet as any).won) {
            s.wins++;
            s.profit += ((bet as any).chips_won || 100) - (bet as any).chips_risked;
          } else {
            s.profit -= (bet as any).chips_risked;
          }
        }

        let topPredictor: { userId: string; wins: number; profit: number } | null = null;
        let biggestWin: { userId: string; profit: number } | null = null;

        for (const [userId, stats] of userStats.entries()) {
          if (!topPredictor || stats.wins > topPredictor.wins || (stats.wins === topPredictor.wins && stats.profit > topPredictor.profit)) {
            topPredictor = { userId, ...stats };
          }
        }

        // Find biggest single win
        for (const bet of relevantBets) {
          if ((bet as any).won) {
            const p = ((bet as any).chips_won || 100) - (bet as any).chips_risked;
            if (!biggestWin || p > biggestWin.profit) {
              biggestWin = { userId: (bet as any).user_id, profit: p };
            }
          }
        }

        // Get usernames for top predictor and biggest winner
        const userIds = new Set<string>();
        if (topPredictor) userIds.add(topPredictor.userId);
        if (biggestWin) userIds.add(biggestWin.userId);
        
        const userNames: Map<string, string> = new Map();
        if (userIds.size > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, username, display_name')
            .in('user_id', Array.from(userIds));
          
          for (const p of profiles || []) {
            // Prefer the real display name; username is a confusing fallback only.
            userNames.set(p.user_id, p.display_name || p.username || 'User');
          }
        }

        // Calculate community vs Kalshi accuracy
        const kalshiCorrect = result.markets.filter(m => {
          const kalshiFavored = m.yesPrice >= 50 ? 'YES' : 'NO';
          return kalshiFavored === m.resolution;
        }).length;
        const kalshiAccuracy = result.markets.length > 0 ? Math.round((kalshiCorrect / result.markets.length) * 100) : 0;
        const accuracyDiff = accuracy - kalshiAccuracy;

        // Build summary message
        const resolvedList = result.markets.map(m => {
          const emoji = m.resolution === 'YES' ? '✅' : '❌';
          return `${emoji} ${m.question} → ${m.resolution}`;
        }).join('\n');

        let summary = `🏁 **Post-Game Summary**\n\n${resolvedList}\n`;

        // Only talk about the huddle's record if the huddle actually played.
        // With zero picks this printed "0 correct / 0 total (0%)" and then
        // "Kalshi was 100% more accurate this time", which is both meaningless
        // and faintly insulting to a room that never bet.
        if (totalBets > 0) {
          summary += `\n**Huddle Performance:**\n`;
          summary += `• ${correctBets} correct / ${totalBets} total (${accuracy}%)\n`;
        }

        if (topPredictor && topPredictor.wins > 0) {
          const name = userNames.get(topPredictor.userId) || 'User';
          summary += `• 🏆 Top predictor: ${name} (${topPredictor.wins} wins, ${topPredictor.profit >= 0 ? '+' : ''}${topPredictor.profit}¢)\n`;
        }

        if (biggestWin) {
          const name = userNames.get(biggestWin.userId) || 'User';
          summary += `• 💰 Biggest win: ${name} (+${biggestWin.profit}¢)\n`;
        }

        // A comparison needs something to compare. No picks, no verdict.
        if (totalBets > 0) {
          if (accuracyDiff > 0) {
            summary += `\n🔥 Our huddle beat Kalshi by ${accuracyDiff}%!`;
          } else if (accuracyDiff < 0) {
            summary += `\n📊 Kalshi was ${Math.abs(accuracyDiff)}% more accurate this time.`;
          } else {
            summary += `\n📊 We matched Kalshi's accuracy!`;
          }
        }

        // Get or create system user for bot messages
        const { data: systemUserId } = await supabase.rpc('get_or_create_system_user');
        if (systemUserId) {
          await supabase.from('huddle_messages').insert({
            huddle_id: huddleId,
            user_id: systemUserId,
            content: summary,
            is_bot_message: true,
            message_type: 'game_summary',
          });
        }
      } catch (err) {
        console.error(`Error posting summary for huddle ${huddleId}:`, err);
      }
    }

    return new Response(JSON.stringify({ settled: totalSettled, voided, summariesPosted: huddleResults.size }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('kalshi-settle error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
