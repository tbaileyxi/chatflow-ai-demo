import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * THE FOUNDING PARTNER'S ONE MOMENT.
 *
 * A single card in the team's room in the two hours before kickoff, carrying
 * the matchup and — only if that team has a founding partner — a small
 * "powered by" line at the bottom. One per game per room. Never mid-game,
 * never after.
 *
 * WHAT THIS IS NOT, and must not become:
 *   - permanent. It is a message in a thread and it scrolls away like one.
 *   - attached to a room. No header, no banner, nothing that persists.
 *   - on a per-update surface. Scores, plays and highlight calls carry no
 *     sponsor, ever. Two moments were sold; these are the two.
 *
 * TEAM ROOMS ONLY. A fixture room belongs to both teams, so a Browns partner
 * would be putting their name in front of Steelers fans who never agreed to
 * see it. Game rooms are excluded, and so are locked rooms: somebody who shut
 * the door did not buy a sponsor.
 */

const PREGAME_WINDOW_MS = 2 * 60 * 60 * 1000;

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** CLE, PIT, KC — the city if we have one, the name if we don't. */
function abbr(city: string | null, name: string): string {
  const base = (city || name || "").trim();
  const words = base.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0] + (words[2]?.[0] ?? "")).toUpperCase().slice(0, 3);
  return base.slice(0, 3).toUpperCase();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dryRun === true;
    const forceGameId: string | null = body?.gameId ?? null;

    const now = Date.now();
    const season = new Date().getFullYear();

    // Games that kick off inside the window. Not ones that already have:
    // if kickoff has passed, the moment is gone and the card does not post.
    let q = supabase
      .from("games")
      .select(
        "id, status, start_time, sport_key, " +
          "home:teams!games_home_team_id_fkey(id, name, city), " +
          "away:teams!games_away_team_id_fkey(id, name, city)",
      )
      .eq("status", "scheduled")
      .gte("start_time", new Date(now).toISOString())
      .lte("start_time", new Date(now + PREGAME_WINDOW_MS).toISOString());
    if (forceGameId) q = supabase
      .from("games")
      .select(
        "id, status, start_time, sport_key, " +
          "home:teams!games_home_team_id_fkey(id, name, city), " +
          "away:teams!games_away_team_id_fkey(id, name, city)",
      )
      .eq("id", forceGameId);

    const { data: games, error: gamesError } = await q;
    if (gamesError) return json({ error: gamesError.message }, 500);
    if (!games || games.length === 0) return json({ posted: 0, note: "No game in the pregame window." });

    const { data: sysUser } = await supabase.rpc("get_or_create_system_user");
    if (!sysUser) return json({ error: "No system user" }, 500);

    let posted = 0;
    const cards: unknown[] = [];

    for (const g of games as any[]) {
      const home = g.home, away = g.away;
      if (!home?.name || !away?.name) continue;

      const kickoff = new Date(g.start_time).toLocaleTimeString("en-US", {
        hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
      });

      // The line, if anyone has posted one. No line is not a reason to skip
      // the card — it is a reason to leave that row out.
      const { data: markets } = await supabase
        .from("kalshi_markets")
        .select("market_type, question, metadata")
        .eq("is_resolved", false)
        .in("team_id", [home.id, away.id])
        .limit(20);
      const spread = (markets ?? []).find((m: any) => m.market_type === "spread");
      const total = (markets ?? []).find((m: any) => m.market_type === "total");

      // One card per team, in that team's own rooms.
      for (const [team, opp] of [[home, away], [away, home]] as any[]) {
        const slug = slugify(`${team.city ?? ""} ${team.name}`.trim());

        const { data: partner } = await supabase
          .from("founding_partners")
          .select("partner_name")
          .eq("team_slug", slug)
          .eq("season", season)
          .maybeSingle();

        // Team rooms only: the community room and people's own huddles. Not
        // fixture rooms, which belong to both sides, and not locked rooms.
        const { data: rooms } = await supabase
          .from("huddles")
          .select("id, is_game_room, is_private, is_dm")
          .eq("team_id", team.id);

        const eligible = (rooms ?? []).filter(
          (r: any) => r.is_game_room !== true && r.is_dm !== true && r.is_private !== true,
        );

        const card = {
          kind: "pregame_card",
          week: g.sport_key?.includes("football") ? "Week " + Math.max(1, Math.ceil((now - Date.parse(`${season}-09-04`)) / (7 * 864e5))) : null,
          kickoff,
          home: { abbr: abbr(home.city, home.name), name: `${home.city ?? ""} ${home.name}`.trim() },
          away: { abbr: abbr(away.city, away.name), name: `${away.city ?? ""} ${away.name}`.trim() },
          spread: spread?.question ?? null,
          total: total?.question ?? null,
          hype: `${team.name} at home in front of their own room.`,
          poweredBy: partner?.partner_name ?? null,
        };
        cards.push({ team: team.name, rooms: eligible.length, card });

        if (dryRun) continue;

        for (const r of eligible) {
          // One per game per room, ever.
          const { data: already } = await supabase
            .from("huddle_messages")
            .select("id")
            .eq("huddle_id", r.id)
            .eq("message_type", "pregame_card")
            .eq("game_id", g.id)
            .limit(1)
            .maybeSingle();
          if (already) continue;

          const { error } = await supabase.from("huddle_messages").insert({
            huddle_id: r.id,
            user_id: sysUser,
            game_id: g.id,
            content: JSON.stringify(card),
            is_bot_message: true,
            message_type: "pregame_card",
          });
          if (!error) posted++;
        }
      }
    }

    return json({ posted, dryRun, cards });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
