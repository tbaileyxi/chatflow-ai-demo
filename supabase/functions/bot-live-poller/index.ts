// bot-live-poller — fires every minute via pg_cron.
//
// Flow:
//   1. Resolve enabled leagues from env (default: NBA only for the v2 launch).
//   2. For each league, ask the provider for live games.
//   3. Filter to games where at least one team is in our DB (and matches TEST_TEAM
//      when TEST_MODE=true).
//   4. Pull play-by-play, run the brain to gate exciting events, dedupe against
//      seen_events, and publish.
//
// No game = no expensive calls. Cheap idle.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getProvider, fetchEspnLeaders } from "../_shared/bot/providers.ts";
import { gateEvents } from "../_shared/bot/brain.ts";
import { generateMessage, defaultPersona } from "../_shared/bot/voice.ts";
import { publish } from "../_shared/bot/publisher.ts";
import { findNbaMatchForTeam, fetchGameStats, pickSide, shootingLine } from "../_shared/bot/highlightly.ts";
import type { Game, League } from "../_shared/bot/types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function enabledLeagues(): League[] {
  const raw = (Deno.env.get("ENABLED_LEAGUES") || "NBA").toUpperCase();
  return raw.split(",").map((s) => s.trim()).filter(Boolean) as League[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "missing supabase env" }), { status: 500 });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const provider = getProvider();

  const TEST_MODE = (Deno.env.get("TEST_MODE") || "false").toLowerCase() === "true";
  const TEST_TEAM = (Deno.env.get("TEST_TEAM") || "").toLowerCase();

  const summary = {
    started_at: new Date().toISOString(),
    provider: provider.name,
    leagues: enabledLeagues(),
    games_seen: 0,
    games_with_followed_team: 0,
    plays_fetched: 0,
    plays_gated: 0,
    posts: 0,
    pushes: 0,
    errors: [] as string[],
  };

  try {
    // Preload DB teams once. Match by canonical lowercased name OR fullName.
    const { data: teams } = await supabase
      .from("teams")
      .select("id, name, city, league, highlightly_display_name");
    const teamIndex = new Map<string, { id: string; name: string; league: string }>();
    for (const t of teams ?? []) {
      const display = (t.highlightly_display_name || `${t.city ?? ""} ${t.name}`.trim());
      teamIndex.set(display.toLowerCase(), { id: t.id, name: display, league: t.league });
      teamIndex.set(String(t.name).toLowerCase(), { id: t.id, name: display, league: t.league });
    }

    for (const league of summary.leagues) {
      const games = await provider.liveGames(league);
      summary.games_seen += games.length;

      const followed = games.filter((g) => matchedTeam(g, teamIndex, TEST_MODE, TEST_TEAM));
      summary.games_with_followed_team += followed.length;

      for (const game of followed) {
        if (game.status !== "in_progress" && game.status !== "halftime") continue;

        const plays = await provider.gameEvents(game.providerId, league);
        summary.plays_fetched += plays.length;
        if (plays.length === 0) continue;

        // Filter plays we've already emitted for this game.
        const { data: seen } = await supabase
          .from("seen_events")
          .select("event_id")
          .eq("game_id", game.providerId)
          .eq("emitted", true);
        const emittedIds = new Set((seen ?? []).map((r) => r.event_id));

        // Dedupe by SCORE STATE, not ESPN play id (which can shift between
        // polls and caused the same "1-1 in the 1st" to post 3 times). One
        // emission per game per resulting score per scoring side.
        const scoreKey = (
          sa: { home: number; away: number } | undefined,
          side: string,
        ) => `${side}@${sa?.away ?? 0}-${sa?.home ?? 0}`;
        const gated = gateEvents(plays).filter(
          (g) => !emittedIds.has(scoreKey(g.play.scoreAfter, g.scoringSide)),
        );
        summary.plays_gated += gated.length;

        for (const g of gated) {
          const dbTeam = resolveTeam(g.team.fullName, g.team.name, teamIndex);
          if (!dbTeam) continue;
          // TEST_MODE: also constrain emission to the test team.
          if (TEST_MODE && TEST_TEAM && !dbTeam.name.toLowerCase().includes(TEST_TEAM)) continue;

          try {
            // Surgical Highlightly enrichment (basketball only for now).
            // Cheap: 1 match lookup + 1 stats call per poll cycle per team, both
            // in-process cached. Skips silently when key/data missing.
            const enrichedFacts = { ...g.facts };

            // Real box-score stat leaders for ALL sports (ESPN). This is the
            // smart-bot fuel: "Brunson 31 PTS, 7 AST" / "Soto 3 H, 2 RBI".
            try {
              const leaders = await fetchEspnLeaders(game.providerId, league);
              const teamLine = leaders.get(dbTeam.name.toLowerCase());
              const rivalName = (g.rival.fullName || g.rival.name).toLowerCase();
              const rivalLine = leaders.get(rivalName);
              if (teamLine) enrichedFacts.teamLeader = teamLine;
              if (rivalLine) enrichedFacts.rivalLeader = rivalLine;
            } catch (err) {
              console.warn("[live-poller] leaders skipped", err);
            }

            // NBA-only Highlightly shooting % (extra texture when available).
            if (league === "NBA" && Deno.env.get("HIGHLIGHTLY_API_KEY")) {
              try {
                const hgMatch = await findNbaMatchForTeam(dbTeam.name);
                if (hgMatch) {
                  const stats = await fetchGameStats(hgMatch.id);
                  if (stats) {
                    const teamSide = pickSide(stats, dbTeam.name);
                    const rivalSide = pickSide(stats, g.rival.fullName || g.rival.name);
                    if (teamSide) {
                      const line = shootingLine(teamSide);
                      if (line) enrichedFacts.teamShootingLine = line;
                    }
                    if (rivalSide) {
                      const line = shootingLine(rivalSide);
                      if (line) enrichedFacts.rivalShootingLine = line;
                    }
                  }
                }
              } catch (err) {
                console.warn("[live-poller] enrichment skipped", err);
              }
            }

            const persona = defaultPersona(dbTeam.name);
            const voice = await generateMessage({
              mode: "in_game",
              team: dbTeam.name,
              rival: g.rival.fullName || g.rival.name,
              persona,
              facts: enrichedFacts,
            });

            // Record the play BEFORE publish to prevent double-emit if publish fails partway.
            const { data: seenRow, error: seenErr } = await supabase
              .from("seen_events")
              .insert({
                game_id: game.providerId,
                event_id: scoreKey(g.play.scoreAfter, g.scoringSide),
                team_id: dbTeam.id,
                excitement_score: g.facts.excitementScore,
                emitted: true,
                emitted_at: new Date().toISOString(),
              })
              .select("id")
              .single();
            if (seenErr) {
              // unique_violation = another runner beat us to this play; skip safely.
              continue;
            }

            const result = await publish({
              client: supabase,
              teamId: dbTeam.id,
              teamName: dbTeam.name,
              mode: "in_game",
              sourceRef: seenRow?.id,
              message: voice.message,
              facts: g.facts,
              excitementScore: g.facts.excitementScore,
              shouldPush: g.shouldPush,
            });
            summary.posts += result.huddleIdsPosted.length;
            if (result.pushed) summary.pushes += 1;
          } catch (err) {
            summary.errors.push(`emit ${game.providerId}/${g.play.providerId}: ${(err as Error).message}`);
          }
        }
      }
    }
    // ── Post-game highlights ──────────────────────────────────────────
    // When a followed team's game has just gone final, drop one fresh
    // YouTube highlight clip into every room for that team. Throttled to
    // ~every 10 min (the poller fires every minute) to protect YouTube
    // quota, and guarded per-room so we never double-post.
    // Sendoff recap runs every poll (no YouTube cost, guarded once per room).
    await postFinals(supabase, summary);
    // Highlights + pregame are throttled to protect YouTube quota / dedupe.
    if (new Date().getUTCMinutes() % 5 === 0) {
      await postHighlights(supabase, summary);
      await postPregames(supabase, summary);
    }
  } catch (err) {
    summary.errors.push(`fatal: ${(err as Error).message}`);
  }

  return new Response(JSON.stringify(summary), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

// Pregame heads-up: when a followed team tips/first-pitches within the next
// ~45 min, drop one "game coming up" message into each of its rooms. Templated
// (no LLM) so it's free and reliable. Guarded per room so it fires once.
async function postPregames(
  supabase: ReturnType<typeof createClient>,
  summary: { errors: string[]; pregames?: number },
): Promise<void> {
  summary.pregames = 0;
  const now = Date.now();
  const soon = new Date(now + 45 * 60 * 1000).toISOString();
  const { data: upcoming } = await supabase
    .from("games")
    .select(
      "id, status, start_time, sport_key, " +
        "home:teams!games_home_team_id_fkey(id, name, city), " +
        "away:teams!games_away_team_id_fkey(id, name, city)",
    )
    .eq("status", "scheduled")
    .gte("start_time", new Date(now).toISOString())
    .lte("start_time", soon);

  if (!upcoming || upcoming.length === 0) return;
  const { data: sysUser } = await supabase.rpc("get_or_create_system_user");
  if (!sysUser) return;
  const sixHoursAgo = new Date(now - 6 * 60 * 60 * 1000).toISOString();
  const verb = (sport: string) =>
    sport.includes("baseball") ? "First pitch" :
    sport.includes("hockey") ? "Puck drop" :
    sport.includes("basketball") ? "Tip-off" : "Kickoff";

  for (const g of upcoming as any[]) {
    const home = g.home;
    const away = g.away;
    if (!home?.name || !away?.name) continue;
    const time = new Date(g.start_time).toLocaleTimeString("en-US", {
      hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
    });
    for (const [team, opp] of [[home, away], [away, home]]) {
      if (!team?.id) continue;
      const { data: huddles } = await supabase
        .from("huddles").select("id").eq("team_id", team.id);
      const body = `🏟️ Game day. ${team.name} take on the ${opp.name}. ${verb(g.sport_key || "")} at ${time} ET — get the room rolling.`;
      for (const h of huddles ?? []) {
        const { data: recent } = await supabase
          .from("huddle_messages").select("id")
          .eq("huddle_id", h.id).eq("message_type", "pregame")
          .gte("created_at", sixHoursAgo).limit(1).maybeSingle();
        if (recent) continue;
        const { error } = await supabase.from("huddle_messages").insert({
          huddle_id: h.id, user_id: sysUser, content: body,
          is_bot_message: true, message_type: "pregame",
        });
        if (!error) summary.pregames = (summary.pregames ?? 0) + 1;
      }
    }
  }
}

// Post-game sendoff: when a followed team's game goes final, drop ONE recap
// (final score + each side's leader) into each room. Guarded once per room.
async function postFinals(
  supabase: ReturnType<typeof createClient>,
  summary: { errors: string[]; finals?: number },
): Promise<void> {
  summary.finals = 0;
  const now = Date.now();
  const threeHoursAgo = new Date(now - 3 * 60 * 60 * 1000).toISOString();
  const { data: finals } = await supabase
    .from("games")
    .select(
      "id, odds_game_id, status, start_time, sport_key, home_score, away_score, " +
        "home:teams!games_home_team_id_fkey(id, name, city), " +
        "away:teams!games_away_team_id_fkey(id, name, city)",
    )
    .eq("status", "final")
    .gte("start_time", threeHoursAgo);
  if (!finals || finals.length === 0) return;

  const { data: sysUser } = await supabase.rpc("get_or_create_system_user");
  if (!sysUser) return;
  const sixHoursAgo = new Date(now - 6 * 60 * 60 * 1000).toISOString();

  for (const g of finals as any[]) {
    const home = g.home, away = g.away;
    if (!home?.name || !away?.name) continue;
    const hs = g.home_score ?? 0, as = g.away_score ?? 0;
    // Pull final leaders for a stat-rich sendoff.
    let leaderLine = "";
    try {
      // sport_key like "basketball_nba" -> league handled by provider via id;
      // we only need leaders keyed by team name.
      const leagueGuess =
        g.sport_key?.includes("basketball") ? "NBA" :
        g.sport_key?.includes("baseball") ? "MLB" :
        g.sport_key?.includes("hockey") ? "NHL" :
        g.sport_key?.includes("ncaaf") ? "NCAAF" : "NFL";
      // ESPN event id lives in odds_game_id ("espn-nba-401859967").
      const espnId = String(g.odds_game_id ?? "").replace(/^espn-[a-z]+-/, "");
      const lead = espnId
        ? await fetchEspnLeaders(espnId, leagueGuess as any)
        : new Map<string, string>();
      const hl = lead.get(`${home.city} ${home.name}`.toLowerCase()) ?? lead.get(home.name.toLowerCase());
      const al = lead.get(`${away.city} ${away.name}`.toLowerCase()) ?? lead.get(away.name.toLowerCase());
      if (hl || al) leaderLine = ` ${[al, hl].filter(Boolean).join(" · ")}.`;
    } catch { /* leaders optional */ }

    for (const team of [home, away]) {
      const { data: huddles } = await supabase
        .from("huddles").select("id").eq("team_id", team.id);
      const won = team.id === home.id ? hs > as : as > hs;
      const body = `🏁 Final: ${away.name} ${as}, ${home.name} ${hs}.${leaderLine} ${won ? "Big one in the books." : "On to the next."}`;
      for (const h of huddles ?? []) {
        const { data: recent } = await supabase
          .from("huddle_messages").select("id")
          .eq("huddle_id", h.id).eq("message_type", "postgame")
          .gte("created_at", sixHoursAgo).limit(1).maybeSingle();
        if (recent) continue;
        const { error } = await supabase.from("huddle_messages").insert({
          huddle_id: h.id, user_id: sysUser, content: body,
          is_bot_message: true, message_type: "postgame",
        });
        if (!error) summary.finals = (summary.finals ?? 0) + 1;
      }
    }
  }
}

async function postHighlights(
  supabase: ReturnType<typeof createClient>,
  summary: { errors: string[]; highlights?: number },
): Promise<void> {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return;
  summary.highlights = 0;

  // Games that finished in the last 3 hours.
  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  const { data: finals } = await supabase
    .from("games")
    .select(
      "id, status, start_time, home_team_id, away_team_id, " +
        "home:teams!games_home_team_id_fkey(id, name, city), " +
        "away:teams!games_away_team_id_fkey(id, name, city)",
    )
    .eq("status", "final")
    .gte("start_time", threeHoursAgo);

  if (!finals || finals.length === 0) return;
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

  for (const g of finals as any[]) {
    const home = g.home;
    const away = g.away;
    // One highlight per game: try each side's rooms.
    for (const [team, opp] of [[home, away], [away, home]]) {
      if (!team?.id) continue;
      const { data: huddles } = await supabase
        .from("huddles")
        .select("id")
        .eq("team_id", team.id);
      for (const h of huddles ?? []) {
        // Guard: skip if any highlight already landed here in the last 4h.
        const { data: recent } = await supabase
          .from("huddle_messages")
          .select("id")
          .eq("huddle_id", h.id)
          .eq("message_type", "youtube_highlight")
          .gte("created_at", fourHoursAgo)
          .limit(1)
          .maybeSingle();
        if (recent) continue;

        try {
          const res = await fetch(`${url}/functions/v1/youtube-highlights`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              team_name: `${team.city ?? ""} ${team.name}`.trim(),
              opponent_name: opp ? `${opp.city ?? ""} ${opp.name}`.trim() : undefined,
              huddle_id: h.id,
            }),
          });
          const json = await res.json().catch(() => ({}));
          if (json?.success) summary.highlights = (summary.highlights ?? 0) + 1;
        } catch (err) {
          summary.errors.push(`highlight ${h.id}: ${(err as Error).message}`);
        }
      }
    }
  }
}

function matchedTeam(
  g: Game,
  index: Map<string, { id: string; name: string; league: string }>,
  testMode: boolean,
  testTeam: string,
): boolean {
  const homeKey = g.home.fullName.toLowerCase();
  const awayKey = g.away.fullName.toLowerCase();
  const homeShort = g.home.name.toLowerCase();
  const awayShort = g.away.name.toLowerCase();
  const knownHome = index.has(homeKey) || index.has(homeShort);
  const knownAway = index.has(awayKey) || index.has(awayShort);
  if (!knownHome && !knownAway) return false;
  if (testMode && testTeam) {
    return homeKey.includes(testTeam) || awayKey.includes(testTeam)
        || homeShort.includes(testTeam) || awayShort.includes(testTeam);
  }
  return true;
}

function resolveTeam(
  fullName: string,
  shortName: string,
  index: Map<string, { id: string; name: string; league: string }>,
): { id: string; name: string } | null {
  return index.get(fullName.toLowerCase()) || index.get(shortName.toLowerCase()) || null;
}
