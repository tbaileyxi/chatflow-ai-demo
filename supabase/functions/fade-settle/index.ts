// fade-settle — grades locked fades whose game is final, then expires stale ones.
//
// For each locked fade we join its game (games.id = fades.game_id) and, once the
// game is final with a total, call settle_fade() to move chips + update the
// head-to-head ledger and season stats. Then we post a recap chat message and
// push the two participants. Finally expire_fades() refunds any open props whose
// game started with no taker. Runs on a cron (see the cron migration).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const nameOf = (p: any) => p?.display_name || p?.username || "A member";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey);

  let settled = 0, pushed = 0, waiting = 0, expired = 0;

  try {
    // 1) Locked fades awaiting a result.
    const { data: fades } = await admin
      .from("fades")
      .select("id, huddle_id, poster_id, accepter_id, game_id, market_id, line_description, fade_type, line_value, stake")
      .eq("status", "locked");

    if (fades && fades.length > 0) {
      // Two grading paths. Market-linked fades (player props, moneyline) settle
      // from the market's own YES/NO result, set by odds-settle from real stats.
      // Legacy game/team-total fades settle from the game's final total.
      const gameIds = [...new Set(fades.map((f) => f.game_id))];
      const { data: games } = await admin
        .from("games")
        .select("id, status, home_score, away_score")
        .in("id", gameIds);
      const finals = new Map(
        (games ?? [])
          .filter((g) => g.status === "final" && g.home_score != null && g.away_score != null)
          .map((g) => [String(g.id), g]),
      );

      const marketIds = [...new Set(fades.map((f) => f.market_id).filter(Boolean))];
      const { data: mkts } = marketIds.length
        ? await admin
            .from("kalshi_markets")
            .select("id, is_resolved, resolution")
            .in("id", marketIds)
        : { data: [] as any[] };
      const resolvedMarkets = new Map(
        (mkts ?? [])
          .filter((m) => m.is_resolved && (m.resolution === "YES" || m.resolution === "NO"))
          .map((m) => [String(m.id), m]),
      );

      const { data: sysUser } = await admin.rpc("get_or_create_system_user");

      for (const f of fades) {
        let result: any = null;
        let total: number | null = null;

        if (f.market_id) {
          // Market-graded fade — wait until the linked market resolves.
          if (!resolvedMarkets.has(String(f.market_id))) { waiting++; continue; }
          const { data, error } = await admin.rpc("settle_fade_by_market", { p_fade_id: f.id });
          if (error) { console.warn(`settle_fade_by_market ${f.id}: ${error.message}`); continue; }
          result = data;
        } else {
          // Game/team-total fade — wait until the game is final.
          const g = finals.get(String(f.game_id));
          if (!g) { waiting++; continue; }
          total = g.home_score + g.away_score;
          const { data, error } = await admin.rpc("settle_fade", {
            p_fade_id: f.id,
            p_home_score: g.home_score,
            p_away_score: g.away_score,
          });
          if (error) { console.warn(`settle_fade ${f.id}: ${error.message}`); continue; }
          result = data;
        }

        if ((result as any)?.skipped) continue;
        settled++;

        // Names for the recap.
        const { data: profs } = await admin
          .from("profiles")
          .select("user_id, display_name, username")
          .in("user_id", [f.poster_id, f.accepter_id]);
        const byId = new Map((profs ?? []).map((p) => [p.user_id, p]));

        let content: string;
        if ((result as any)?.result === "push") {
          content = `🏁 Push — ${f.line_description} landed exactly on ${f.line_value}. Both refunded.`;
        } else {
          const winId = (result as any)?.winner;
          const loseId = winId === f.poster_id ? f.accepter_id : f.poster_id;
          // Only game-total fades have a meaningful "final total" to show.
          const detail = total != null ? ` (final total ${total})` : "";
          content = `🏁 ${nameOf(byId.get(winId))} beat ${nameOf(byId.get(loseId))} — ${f.line_description}${detail}. +${(result as any)?.pot} chips.`;
        }

        if (sysUser) {
          await admin.from("huddle_messages").insert({
            huddle_id: f.huddle_id, user_id: sysUser,
            content, is_bot_message: true, message_type: "fade",
          });
        }

        // Push the two participants.
        const { data: pushProfs } = await admin
          .from("profiles")
          .select("expo_push_token")
          .in("user_id", [f.poster_id, f.accepter_id])
          .not("expo_push_token", "is", null);
        const messages = (pushProfs ?? [])
          .filter((p) => p.expo_push_token)
          .map((p) => ({
            to: p.expo_push_token, sound: "default",
            title: "Fade settled", body: content.replace(/^🏁 /, ""),
            data: { type: "fade_settled", huddleId: f.huddle_id },
          }));
        if (messages.length > 0) {
          try {
            await fetch(EXPO_PUSH_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json", Accept: "application/json" },
              body: JSON.stringify(messages),
            });
            pushed += messages.length;
          } catch (e) { console.warn("push failed", e); }
        }
      }
    }

    // 2) Refund open props whose game started with no taker.
    const { data: expiredCount } = await admin.rpc("expire_fades");
    expired = Number(expiredCount) || 0;

    return new Response(
      JSON.stringify({ ok: true, settled, pushed, waiting, expired }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
