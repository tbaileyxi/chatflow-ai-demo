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

/**
 * Team colors and abbreviations, from ESPN.
 *
 * The blocks on the card were grey because nothing we store has a color for
 * most teams — src/lib/teams.ts has twenty hand-picked, and the Lions are not
 * one of them. ESPN publishes the official color and abbreviation for every
 * team in every league, which also retires the guess below that turned "New
 * York" into "NY" for two different teams.
 *
 * One request per league per run, and a failure costs the color, never the card.
 */
type Look = { abbr: string; color: string; ink: string };

const ESPN_PATH: Record<string, string> = {
  americanfootball_nfl: "football/nfl",
  americanfootball_ncaaf: "football/college-football",
  basketball_nba: "basketball/nba",
  basketball_ncaab: "basketball/mens-college-basketball",
  baseball_mlb: "baseball/mlb",
  icehockey_nhl: "hockey/nhl",
};

/** Black or white, whichever reads on this background. */
function inkFor(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "#FFFFFF";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.45 ? "#000000" : "#FFFFFF";
}

async function espnLooks(sportKey: string): Promise<Map<string, Look>> {
  const out = new Map<string, Look>();
  const path = ESPN_PATH[sportKey];
  if (!path) return out;
  try {
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${path}/teams?limit=400`);
    const data = await res.json();
    for (const t of data?.sports?.[0]?.leagues?.[0]?.teams ?? []) {
      const team = t.team;
      if (!team?.displayName) continue;
      // A near-black primary disappears on a dark card, so the alternate wins
      // when the primary is too dark to see.
      let color = team.color ? `#${team.color}` : null;
      const alt = team.alternateColor ? `#${team.alternateColor}` : null;
      if (color && alt && inkFor(color) === "#FFFFFF") {
        const h = color.replace("#", "");
        const sum = parseInt(h.slice(0, 2), 16) + parseInt(h.slice(2, 4), 16) + parseInt(h.slice(4, 6), 16);
        if (sum < 60) color = alt;
      }
      if (!color) continue;
      const look = { abbr: team.abbreviation ?? "", color, ink: inkFor(color) };
      out.set(team.displayName.toLowerCase(), look);
      if (team.shortDisplayName) out.set(team.shortDisplayName.toLowerCase(), look);
    }
  } catch {
    // No colors this run. The card still posts, in grey.
  }
  return out;
}

/** CLE, PIT, KC — the fallback when ESPN has nothing for this team. */
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
    // An explicit, separate flag. Naming a gameId alone must not be enough to
    // put a card in a room outside the pregame window — that is the rule this
    // whole function exists to keep, and a typo should not be able to break it.
    const overrideWindow = body?.overrideWindow === true;
    // For screenshots: post into exactly one room and no others.
    const onlyHuddleId: string | null = body?.huddleId ?? null;

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
    if (forceGameId && overrideWindow) {
      q = supabase
        .from("games")
        .select(
          "id, status, start_time, sport_key, " +
            "home:teams!games_home_team_id_fkey(id, name, city), " +
            "away:teams!games_away_team_id_fkey(id, name, city)",
        )
        .eq("id", forceGameId);
    } else if (forceGameId) {
      q = q.eq("id", forceGameId);
    }

    const { data: games, error: gamesError } = await q;
    if (gamesError) return json({ error: gamesError.message }, 500);
    if (!games || games.length === 0) return json({ posted: 0, note: "No game in the pregame window." });

    const { data: sysUser } = await supabase.rpc("get_or_create_system_user");
    if (!sysUser) return json({ error: "No system user" }, 500);

    let posted = 0;
    const cards: unknown[] = [];
    const looksByLeague = new Map<string, Map<string, Look>>();
    const failures: string[] = [];

    for (const g of games as any[]) {
      const home = g.home, away = g.away;
      if (!home?.name || !away?.name) continue;

      const sportKey = g.sport_key || "";
      if (!looksByLeague.has(sportKey)) looksByLeague.set(sportKey, await espnLooks(sportKey));
      const looks = looksByLeague.get(sportKey)!;
      const lookFor = (t: any): Look | null => {
        const full = `${t.city ?? ""} ${t.name}`.trim().toLowerCase();
        return looks.get(full) ?? looks.get(String(t.name).toLowerCase()) ?? null;
      };
      const homeLook = lookFor(home);
      const awayLook = lookFor(away);

      const kickoff = new Date(g.start_time).toLocaleTimeString("en-US", {
        hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
      });

      // THE LINE, ONLY IF IT IS ACTUALLY A LINE.
      //
      // kalshi_markets stores a question — "Rays win by over 1.5" — not a
      // spread and a total. An earlier version of this printed that text in
      // the numbers row, which meant the card showed a betting number nobody
      // had priced as one. If metadata carries a real line we use it; if it
      // does not, the row is left out entirely and the matchup, the kickoff
      // and the hype line carry the card.
      const { data: markets } = await supabase
        .from("kalshi_markets")
        .select("market_type, metadata")
        .eq("is_resolved", false)
        .in("team_id", [home.id, away.id])
        .limit(20);

      // AND THE NUMBERS ROW IS OFF UNTIL THERE IS A REAL LINE TO PRINT.
      //
      // A dry run over tonight's slate produced "Spread -1.5 · O/U 35.5" for an
      // NFL game. A 35.5 total is not a football total, and -1.5 names no side
      // — those numbers come from a "win by over 1.5" market that happens to
      // carry a `line` in its metadata. It is the same mistake as printing the
      // question text, one layer down: a number that is real in its own market
      // and false on this card.
      //
      // There is no source of a clean spread and total for a game today, so the
      // row is omitted entirely and the matchup, the kickoff and the hype line
      // carry the card. When a real odds field exists, this is where it goes.
      const spreadLine: string | null = null;
      const totalLine: string | null = null;

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

        const eligible = (rooms ?? [])
          .filter((r: any) => r.is_game_room !== true && r.is_dm !== true && r.is_private !== true)
          .filter((r: any) => !onlyHuddleId || r.id === onlyHuddleId);

        const card = {
          kind: "pregame_card",
          // The game lives IN the payload because huddle_messages has no
          // game_id column — an earlier version set one, every insert failed,
          // and `if (!error) posted++` reported 0 posted with no error at all.
          gameId: g.id,
          week: g.sport_key?.includes("football") ? "Week " + Math.max(1, Math.ceil((now - Date.parse(`${season}-09-04`)) / (7 * 864e5))) : null,
          kickoff,
          home: {
            abbr: homeLook?.abbr || abbr(home.city, home.name),
            name: `${home.city ?? ""} ${home.name}`.trim(),
            color: homeLook?.color ?? null,
            ink: homeLook?.ink ?? null,
          },
          away: {
            abbr: awayLook?.abbr || abbr(away.city, away.name),
            name: `${away.city ?? ""} ${away.name}`.trim(),
            color: awayLook?.color ?? null,
            ink: awayLook?.ink ?? null,
          },
          spread: spreadLine ? `Spread ${spreadLine}` : null,
          total: totalLine ? `O/U ${totalLine}` : null,
          // The away team is not at home. This said "at home" on every card,
          // so half of every slate was wrong on its face.
          hype:
            team.id === home.id
              ? `${team.name} at home in front of their own room.`
              : `${team.name} on the road. Get the room in before kickoff.`,
          poweredBy: partner?.partner_name ?? null,
        };
        cards.push({ team: team.name, rooms: eligible.length, card });

        if (dryRun) continue;

        for (const r of eligible) {
          // One per game per room, ever. Matched on the game id inside the
          // payload, since the column does not exist.
          const { data: priors } = await supabase
            .from("huddle_messages")
            .select("id, content")
            .eq("huddle_id", r.id)
            .eq("message_type", "pregame_card")
            .limit(50);
          const already = (priors ?? []).some((m: any) =>
            typeof m.content === "string" && m.content.includes(g.id),
          );
          if (already) continue;

          const { error } = await supabase.from("huddle_messages").insert({
            huddle_id: r.id,
            user_id: sysUser,
            content: JSON.stringify(card),
            is_bot_message: true,
            message_type: "pregame_card",
          });
          // A failed insert must never look like a quiet no-op again.
          if (error) failures.push(`${r.id}: ${error.message}`);
          else posted++;
        }
      }
    }

    return json({ posted, dryRun, failures, cards });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
