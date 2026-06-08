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
import { getProvider } from "../_shared/bot/providers.ts";
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

        const gated = gateEvents(plays).filter((g) => !emittedIds.has(g.play.providerId));
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
                event_id: g.play.providerId,
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
  } catch (err) {
    summary.errors.push(`fatal: ${(err as Error).message}`);
  }

  return new Response(JSON.stringify(summary), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

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
