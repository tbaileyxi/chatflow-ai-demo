import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Drops a short slate of UNCLAIMED fade props into every room watching a game,
// the way the original gameday flow worked: 3–4 props with a real line pop up in
// chat, someone takes a side, someone takes the other. This function only posts
// the cards — the claim (which stakes chips) happens client-side under the
// tapping user's own auth via post_fade, so nothing here needs a poster.
//
// Only games that live in the `games` table are eligible, because that is what
// fade-settle grades from a final score. Markets come from the same
// SportsGameOdds feed as predictions (kalshi_markets) — never invented numbers.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FADEABLE = ["player_prop", "total", "spread"];
const MAX_PROPS_PER_GAME = 4;

// Turn a kalshi_markets row into the card's display fields. Mirrors the client's
// useFadeMarkets so a bot card and a player-posted card read identically.
function marketCard(m: any): {
  label: string;
  line: number | null;
  over: string;
  under: string;
  description: string;
} | null {
  const meta = (m.metadata ?? {}) as Record<string, any>;
  const type = m.market_type;
  const q: string = m.question ?? "";
  const line = meta.line ?? meta.spread ?? null;

  if (type === "player_prop" && line != null) {
    const who = meta.player ?? q.replace(/\s+over\s+[\d.]+.*$/i, "").trim();
    const stat = String(meta.stat ?? "")
      .replace(/^batting_|^pitching_/, "")
      .replace(/_/g, " ");
    const unit = stat || q.match(/over\s+[\d.]+\s+(.+?)\?/i)?.[1] || "";
    return {
      label: `${who} ${line} ${unit}`.trim(),
      line: Number(line),
      over: `Over ${line}`,
      under: `Under ${line}`,
      description: q,
    };
  }
  if (type === "total" && line != null) {
    return {
      label: `Total ${line}`,
      line: Number(line),
      over: `Over ${line}`,
      under: `Under ${line}`,
      description: q,
    };
  }
  if (type === "spread" && line != null) {
    const signed = Number(line) > 0 ? `+${line}` : `${line}`;
    return {
      label: `Spread ${signed}`,
      line: Number(line),
      over: `Covers ${signed}`,
      under: `Doesn't cover ${signed}`,
      description: q,
    };
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date();
    const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // 1) Upcoming, settleable games (in `games`, not yet started, within 24h).
    const { data: games } = await supabase
      .from("games")
      .select("id, home_team_id, away_team_id, start_time, sport_key, status")
      .gt("start_time", now.toISOString())
      .lt("start_time", windowEnd.toISOString())
      .not("status", "in", "(final,cancelled,postponed)");

    if (!games || games.length === 0) {
      return new Response(JSON.stringify({ posted: 0, reason: "no upcoming settleable games" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const teamIds = [
      ...new Set(games.flatMap((g) => [g.home_team_id, g.away_team_id]).filter(Boolean)),
    ] as string[];

    // 2) Team names and fadeable markets for those teams.
    const [{ data: teams }, { data: markets }] = await Promise.all([
      supabase.from("teams").select("id, name").in("id", teamIds),
      supabase
        .from("kalshi_markets")
        .select("id, question, market_type, team_id, event_start_time, metadata, is_resolved")
        .in("team_id", teamIds)
        .eq("is_resolved", false)
        .in("market_type", FADEABLE),
    ]);
    const teamName = new Map((teams ?? []).map((t: any) => [t.id, t.name]));

    // 3) The system (bot) user that authors the cards.
    const { data: systemUserId } = await supabase.rpc("get_or_create_system_user");
    if (!systemUserId) throw new Error("Failed to get system user");

    let posted = 0;

    for (const game of games) {
      const gTeams = [game.home_team_id, game.away_team_id].filter(Boolean) as string[];
      const start = new Date(game.start_time).getTime();

      // Markets for this game's teams, close to its start (so a team's next
      // series doesn't bleed into tonight's card), best-first, capped.
      const gameMarkets = (markets ?? [])
        .filter(
          (m: any) =>
            gTeams.includes(m.team_id) &&
            Math.abs(new Date(m.event_start_time).getTime() - start) < 6 * 60 * 60 * 1000,
        )
        .slice(0, MAX_PROPS_PER_GAME);

      if (gameMarkets.length === 0) continue;

      // Rooms watching either team.
      const { data: huddles } = await supabase
        .from("huddles")
        .select("id")
        .in("team_id", gTeams);
      if (!huddles || huddles.length === 0) continue;

      const home = game.home_team_id ? teamName.get(game.home_team_id) ?? "Home" : "Home";
      const away = game.away_team_id ? teamName.get(game.away_team_id) ?? "Away" : "Away";
      const gamePayload = {
        id: String(game.id),
        start_time: game.start_time,
        home,
        away,
        sport: game.sport_key ?? "",
      };

      for (const h of huddles) {
        // Skip markets already dropped in this room recently, so a re-run
        // doesn't stack duplicate cards.
        const { data: recent } = await supabase
          .from("huddle_messages")
          .select("content")
          .eq("huddle_id", h.id)
          .eq("message_type", "fade_prop")
          .gte("created_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString());
        const already = new Set<string>();
        (recent ?? []).forEach((r: any) => {
          try {
            const p = JSON.parse(r.content);
            if (p.market_id) already.add(p.market_id);
          } catch {
            /* ignore non-JSON */
          }
        });

        const rows = gameMarkets
          .filter((m: any) => !already.has(m.id))
          .map((m: any) => {
            const card = marketCard(m);
            if (!card) return null;
            return {
              huddle_id: h.id,
              user_id: systemUserId,
              is_bot_message: true,
              message_type: "fade_prop",
              content: JSON.stringify({
                // No fade_id: this is unclaimed. The first tap claims a side and
                // links a fade back via origin_message_id.
                market_id: m.id,
                label: card.label,
                description: card.description,
                over_label: card.over,
                under_label: card.under,
                line: card.line,
                game: gamePayload,
              }),
            };
          })
          .filter(Boolean);

        if (rows.length > 0) {
          const { error } = await supabase.from("huddle_messages").insert(rows as any[]);
          if (!error) posted += rows.length;
        }
      }
    }

    return new Response(JSON.stringify({ posted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("fade-post-props error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
