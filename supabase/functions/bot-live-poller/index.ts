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
import { getProvider, fetchEspnLeaders, fetchEspnBoxScoreLines } from "../_shared/bot/providers.ts";
import { gateEvents } from "../_shared/bot/brain.ts";
import { searchX } from "../_shared/coach/xsearch.ts";
import { fetchPostMedia, pickBest, postIdFromUrl } from "../_shared/x/media.ts";
import { generateMessage, defaultPersona } from "../_shared/bot/voice.ts";
import { publish } from "../_shared/bot/publisher.ts";
import { findNbaMatchForTeam, fetchGameStats, pickSide, shootingLine } from "../_shared/bot/highlightly.ts";
import type { Game, League } from "../_shared/bot/types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map a games.sport_key ("baseball_mlb", "basketball_nba", …) to our League.
function sportKeyToLeague(sportKey: string | null | undefined): League | null {
  const s = (sportKey || "").toLowerCase();
  const college = s.includes("ncaa") || s.includes("college");
  if (s.includes("basketball")) return college ? "NCAAB" : "NBA";
  if (s.includes("baseball")) return "MLB";
  if (s.includes("hockey")) return "NHL";
  if (s.includes("football")) return college ? "NCAAF" : "NFL";
  return null;
}

// Which leagues to poll this tick.
//   • ENABLED_LEAGUES env set → honor it verbatim (manual override / TEST_MODE).
//   • otherwise → derive from the games the score-sync has marked live right
//     now. Zero ESPN calls when nothing is live (cheap idle), and it auto-covers
//     every league + same-day doubleheaders with no secret to maintain.
async function resolveLeagues(
  supabase: ReturnType<typeof createClient>,
): Promise<League[]> {
  const raw = (Deno.env.get("ENABLED_LEAGUES") || "").toUpperCase().trim();
  if (raw) {
    return raw.split(",").map((s) => s.trim()).filter(Boolean) as League[];
  }
  const { data } = await supabase
    .from("games")
    .select("sport_key")
    .in("status", ["in_progress", "live", "halftime"]);
  const set = new Set<League>();
  for (const g of (data ?? []) as { sport_key: string | null }[]) {
    const lg = sportKeyToLeague(g.sport_key);
    if (lg) set.add(lg);
  }
  return [...set];
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
    leagues: [] as League[],
    games_seen: 0,
    games_with_followed_team: 0,
    plays_fetched: 0,
    plays_gated: 0,
    covered_teams: 0,
    x_moments: 0,        // clips pulled from X for a big play
    x_moment_reads: 0,   // billed X post reads spent doing it
    x_clips_24h: 0,      // in-game clips that landed in the last day
    x_claims_total: 0,   // clip attempts ever made, across every run
    x_attempts: 0,       // times we entered the clip block
    x_claim_failed: 0,   // seen_events claim rejected (another runner, or a constraint)
    x_citations: 0,      // post URLs xAI came back with
    x_no_media: 0,       // read the posts, none carried a photo or video
    excitement_seen: [] as number[], // scores of plays we emitted, to sanity-check the clip bar
    targets_built: 0,
    skipped_not_covered: 0,
    covered_targets: 0,
    plays_scoring: 0,      // plays the provider says put points on the board
    gate_candidates: 0,    // what gateEvents returned, BEFORE dedupe
    deduped_out: 0,        // dropped because that score state already posted
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

    // Count how many teams share each bare nickname. College is full of these:
    // Tigers is claimed by Missouri, Auburn, LSU, Clemson AND Detroit; Wildcats
    // by four schools. A shared nickname cannot identify a team, so we refuse to
    // index it rather than letting last-write-win silently pick the wrong one.
    const nicknameCount = new Map<string, number>();
    for (const t of teams ?? []) {
      const n = String(t.name ?? "").toLowerCase().trim();
      if (n) nicknameCount.set(n, (nicknameCount.get(n) ?? 0) + 1);
    }

    // Nicknames are also counted PER LEAGUE. Most collisions are cross-sport:
    // Panthers is Carolina (NFL), Florida (NHL) and Pittsburgh (NCAA), but it
    // is unique inside each one. Since we always know which league we are
    // polling, a league-scoped key makes 31 more teams resolvable by nickname
    // than a global key does. Only 4 nicknames stay ambiguous after this, all
    // inside NCAA (tigers, wildcats, bulldogs, cougars).
    const perLeagueCount = new Map<string, number>();
    for (const t of teams ?? []) {
      const k = `${t.league}::${String(t.name ?? "").toLowerCase().trim()}`;
      perLeagueCount.set(k, (perLeagueCount.get(k) ?? 0) + 1);
    }

    for (const t of teams ?? []) {
      // ALWAYS index "City Nickname" — this is what ESPN sends as displayName
      // ("Ohio State Buckeyes"). Previously highlightly_display_name won via
      // `||`, and for NCAA rows it holds only the nickname ("Buckeyes"), so the
      // full name was never indexed and every college game fell through to the
      // ambiguous nickname path.
      const full = `${t.city ?? ""} ${t.name ?? ""}`.trim();
      const display = (t.highlightly_display_name || full);
      const entry = { id: t.id, name: full || display, league: t.league };

      // Full names are unambiguous, so they get both a global and a scoped key.
      if (full) {
        teamIndex.set(full.toLowerCase(), entry);
        teamIndex.set(`${t.league}::${full.toLowerCase()}`, entry);
      }

      for (const alias of [t.highlightly_display_name, t.name]) {
        const key = String(alias ?? "").toLowerCase().trim();
        if (!key || key === full.toLowerCase()) continue;
        // Scoped key: safe whenever the nickname is unique WITHIN its league.
        const scoped = `${t.league}::${key}`;
        if ((perLeagueCount.get(scoped) ?? 0) === 1 && !teamIndex.has(scoped)) {
          teamIndex.set(scoped, entry);
        }
        // Global key: only when unique across every league.
        if ((nicknameCount.get(key) ?? 0) > 1) continue;
        if (!teamIndex.has(key)) teamIndex.set(key, entry);
      }
    }

    summary.leagues = await resolveLeagues(supabase);

    // Only cover teams somebody made a room for. This polled every team with
    // any huddle, which meant 195 seeded Community rooms — 88 live plays in a
    // day, none of them in a room a person had opened.
    const { data: ownRooms } = await supabase
      .from("huddles")
      .select("team_id")
      .not("team_id", "is", null)
      .or("is_official_team_huddle.is.false,is_official_team_huddle.is.null");
    const coveredTeams = new Set((ownRooms ?? []).map((r: any) => r.team_id));
    summary.covered_teams = coveredTeams.size;
    // The clip posts as the same bot that narrated the play.
    const { data: botUserId } = await supabase.rpc("get_or_create_system_user");
    // Ops counter, not a reader: how many in-game clips have landed today.
    {
      const since = new Date(Date.now() - 24 * 3600_000).toISOString();
      const { count } = await supabase
        .from("huddle_messages")
        .select("id", { count: "exact", head: true })
        .eq("message_type", "live_play")
        .like("embed_code", "https://x.com/%")
        .gte("created_at", since);
      summary.x_clips_24h = count ?? 0;
      // Persistent evidence. Every clip attempt writes an 'xlive:' row into
      // seen_events BEFORE searching, so this counts attempts across all runs —
      // including the cron runs I never see. Attempts > 0 with clips at 0 means
      // the search or the media fetch is coming back empty, not that the block
      // never fires.
      const { count: claims } = await supabase
        .from("seen_events")
        .select("id", { count: "exact", head: true })
        .like("event_id", "xlive:%");
      summary.x_claims_total = claims ?? 0;
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
        // Clips already pulled for this game, so a wild fourth quarter can't
        // run the bill up on its own.
        let clipsThisGame = [...emittedIds].filter((k) => String(k).startsWith("xlive:")).length;

        // Dedupe by SCORE STATE, not ESPN play id (which can shift between
        // polls and caused the same "1-1 in the 1st" to post 3 times). One
        // emission per game per resulting score per scoring side.
        const scoreKey = (
          sa: { home: number; away: number } | undefined,
          side: string,
        ) => `${side}@${sa?.away ?? 0}-${sa?.home ?? 0}`;
        summary.plays_scoring += plays.filter((p) => (p.pointsScored ?? 0) > 0).length;
        const candidates = gateEvents(plays);
        summary.gate_candidates += candidates.length;
        const gated = candidates;
        summary.plays_gated += gated.length;

        for (const g of gated) {
          // BOTH SIDES. This used to publish only to the team that scored, so
          // a room watching its team get shut out stayed silent — the Bucs
          // room saw nothing at 0-10 because every score belonged to the Jets.
          // Being scored on is the moment a room has the most to say.
          const scorer = lookupTeam(g.team.fullName, g.team.name, teamIndex, league);
          const conceder = lookupTeam(g.rival.fullName, g.rival.name, teamIndex, league);
          const baseKey = scoreKey(g.play.scoreAfter, g.scoringSide);
          const targets: {
            team: NonNullable<ReturnType<typeof lookupTeam>>;
            opponent: string;
            conceded: boolean;
            key: string;
          }[] = [];
          if (scorer) {
            targets.push({
              team: scorer,
              opponent: g.rival.fullName || g.rival.name,
              conceded: false,
              key: baseKey, // unchanged, so nothing already posted re-posts
            });
          }
          if (conceder) {
            targets.push({
              team: conceder,
              opponent: g.team.fullName || g.team.name,
              conceded: true,
              key: `against:${baseKey}`,
            });
          }

          summary.targets_built += targets.length;
          for (const t of targets) {
          const dbTeam = t.team;
          // Skip teams nobody has a room for, and plays already emitted for
          // THIS side — the two sides carry different keys.
          if (!coveredTeams.has(dbTeam.id)) { summary.skipped_not_covered += 1; continue; }
          summary.covered_targets += 1;
          if (emittedIds.has(t.key)) { summary.deduped_out += 1; continue; }
          // TEST_MODE: also constrain emission to the test team.
          if (TEST_MODE && TEST_TEAM && !dbTeam.name.toLowerCase().includes(TEST_TEAM)) continue;

          try {
            // Surgical Highlightly enrichment (basketball only for now).
            // Cheap: 1 match lookup + 1 stats call per poll cycle per team, both
            // in-process cached. Skips silently when key/data missing.
            const enrichedFacts: Record<string, unknown> = {
              ...g.facts,
              // The voice must know whether this went FOR or AGAINST the room.
              scoredAgainstUs: t.conceded,
            };

            // Real box-score stat leaders for ALL sports (ESPN). This is the
            // smart-bot fuel: "Brunson 31 PTS, 7 AST" / "Soto 3 H, 2 RBI".
            try {
              // Box score first: it is populated for every sport (ESPN's
              // `leaders` array is empty for MLB) and it lets us look up the
              // specific player who just did the thing.
              const box = await fetchEspnBoxScoreLines(game.providerId, league);

              // Match the scorer named in this play to their own stat line.
              // This is the "something they didn't know" beat — they watched
              // the homer, they didn't see it was his 3rd hit on a .231 year.
              const scorer = String(g.facts.scorer ?? "").toLowerCase().trim();
              if (scorer) {
                const lastName = scorer.split(" ").slice(-1)[0] ?? "";
                enrichedFacts.scorerStatLine =
                  box.byPlayer.get(scorer) ?? box.byPlayer.get(lastName) ?? undefined;
              }

              // Team lines: try every name variant, since our DB stores the
              // nickname ("Mets") and ESPN keys on the full name.
              const teamVariants = [dbTeam.name, `${dbTeam.city ?? ""} ${dbTeam.name}`.trim()];
              const rivalVariants = [g.rival.fullName, g.rival.name, g.rival.abbreviation];
              for (const v of teamVariants) {
                const hit = v && box.byTeam.get(String(v).toLowerCase().trim());
                if (hit) { enrichedFacts.teamLeader = hit; break; }
              }
              for (const v of rivalVariants) {
                const hit = v && box.byTeam.get(String(v).toLowerCase().trim());
                if (hit) { enrichedFacts.rivalLeader = hit; break; }
              }

              // Legacy leaders call as a backstop for leagues where ESPN does
              // populate it and the box score comes back thin.
              if (!enrichedFacts.teamLeader) {
                const leaders = await fetchEspnLeaders(game.providerId, league);
                const teamLine = leaders.get(dbTeam.name.toLowerCase());
                const rivalLine = leaders.get((g.rival.fullName || g.rival.name).toLowerCase());
                if (teamLine) enrichedFacts.teamLeader = teamLine;
                if (rivalLine && !enrichedFacts.rivalLeader) enrichedFacts.rivalLeader = rivalLine;
              }
            } catch (err) {
              console.warn("[live-poller] box score skipped", err);
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

            // What this bot already said in this team's rooms. One query per
            // emit, cheap and capped, but it is the only way the model can
            // avoid re-narrating the touchdown when the extra point lands.
            try {
              const { data: hRows } = await supabase
                .from("huddles").select("id").eq("team_id", dbTeam.id).limit(1);
              if (hRows?.[0]?.id) {
                const { data: prev } = await supabase
                  .from("huddle_messages")
                  .select("content")
                  .eq("huddle_id", hRows[0].id)
                  .eq("message_type", "live_play")
                  .order("created_at", { ascending: false })
                  .limit(3);
                const lines = (prev ?? []).map((r: any) => String(r.content)).filter(Boolean);
                if (lines.length) enrichedFacts.recentLines = lines;
              }
            } catch (err) {
              console.warn("[live-poller] recent lines skipped", err);
            }

            const persona = defaultPersona(dbTeam.name, dbTeam.league);
            const voice = await generateMessage({
              mode: "in_game",
              team: dbTeam.name,
              rival: t.opponent,
              persona,
              facts: enrichedFacts,
            });

            // Record the play BEFORE publish to prevent double-emit if publish fails partway.
            const { data: seenRow, error: seenErr } = await supabase
              .from("seen_events")
              .insert({
                game_id: game.providerId,
                event_id: t.key,
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
            summary.excitement_seen.push(g.facts.excitementScore ?? 0);

            // THE CLIP. The box score says a touchdown happened; X has the
            // video of it. Only for plays already big enough to be worth a
            // push notification — tying spend to the moments people would
            // screenshot, not to every field goal.
            // 65, not the push bar of 80. Excitement weights closeness and
            // late-game leverage, so a Q2 preseason touchdown scores low by
            // design and August would never produce a clip. The per-game cap
            // is what bounds the spend; this only decides WHICH plays get one.
            const XLIVE_MIN = Number(Deno.env.get("XLIVE_MIN_EXCITEMENT") || 0);
            const XLIVE_PER_GAME = Number(Deno.env.get("XLIVE_PER_GAME") || 3);
            const XLIVE_PER_RUN = Number(Deno.env.get("XLIVE_PER_RUN") || 1);
            const XLIVE_MAX_READS = Number(Deno.env.get("XLIVE_MAX_READS") || 3);
            if (
              Deno.env.get("X_API_BEARER_TOKEN") &&
              (g.facts.excitementScore ?? 0) >= XLIVE_MIN &&
              result.huddleIdsPosted.length > 0 &&
              clipsThisGame < XLIVE_PER_GAME &&
              summary.x_moments < XLIVE_PER_RUN
            ) {
              // Claim the play BEFORE searching. A unique violation means a
              // parallel run already took it; searching first would pay xAI
              // twice for one touchdown.
              const claim = await supabase.from("seen_events").insert({
                game_id: game.providerId,
                event_id: `xlive:${t.key}`,
                team_id: dbTeam.id,
                excitement_score: g.facts.excitementScore,
                emitted: true,
                emitted_at: new Date().toISOString(),
              });
              summary.x_attempts += 1;
              if (claim.error) summary.x_claim_failed += 1;
              if (!claim.error) {
                clipsThisGame += 1;
                try {
                  // Ask about the GAME, not the single play.
                  //
                  // The first version named the exact play and demanded a post
                  // from the last 20 minutes. searchX answers "NOTHING RECENT"
                  // when it cannot match that, and it never could: 12 attempts,
                  // 12 empty. Nobody posts video of a third-inning single
                  // within 20 minutes. The play is a good REASON to go looking
                  // and a terrible search term.
                  // The room has a side. Asking for "best clip from the
                  // Yankees vs Blue Jays game" got a Blue Jays highlight
                  // dropped into a Yankees room — technically responsive,
                  // completely wrong. Same allegiance rule the voice already
                  // follows: this room's team, or the moment that happened TO
                  // them. Never a celebration of the other side.
                  const who = g.facts.scorer ? ` Especially ${g.facts.scorer}.` : "";
                  const found = await searchX(
                    `Find a video or photo of the ${dbTeam.name} posted in the last two hours, ` +
                      `from their game against the ${t.opponent} being played today.${who} ` +
                      `It must feature the ${dbTeam.name} — their players, their bench, their fans, ` +
                      `or a play that happened to them. ` +
                      `Do NOT return ${t.opponent} highlights or posts celebrating the ${t.opponent}. ` +
                      `Ignore previews, predictions, betting picks and old highlights.`,
                  );
                  const ids = [...new Set(
                    found.citations.map(postIdFromUrl).filter(Boolean) as string[],
                  )].slice(0, XLIVE_MAX_READS);
                  summary.x_citations += ids.length;
                  summary.x_moment_reads += ids.length;
                  const best = pickBest(await fetchPostMedia(ids));
                  if (!best) summary.x_no_media += 1;
                  if (best) {
                    const quote = best.text
                      .replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim().slice(0, 140);
                    await supabase.from("huddle_messages").insert(
                      result.huddleIdsPosted.map((hid: string) => ({
                        huddle_id: hid,
                        user_id: botUserId,
                        content: [quote && `"${quote}"`, best.authorHandle && `— @${best.authorHandle}`]
                          .filter(Boolean).join("\n") || `via @${best.authorHandle ?? "X"}`,
                        embed_code: best.url,
                        is_bot_message: true,
                        is_team_agent_message: true,
                        message_type: "live_play",
                        media_url: best.videoUrl ?? best.imageUrl,
                        media_type: best.videoUrl ? "video" : "image",
                      })),
                    );
                    summary.x_moments += 1;
                  }
                } catch (err) {
                  console.warn("[live-poller] x moment skipped", err);
                }
              }
            }
          } catch (err) {
            summary.errors.push(`emit ${game.providerId}/${g.play.providerId}: ${(err as Error).message}`);
          }
          }
        }
      }
    }
    // ── Post-game highlights ──────────────────────────────────────────
    // When a followed team's game has just gone final, drop one fresh
    // YouTube highlight clip into every room for that team. Throttled to
    // ~every 10 min (the poller fires every minute) to protect YouTube
    // quota, and guarded per-room so we never double-post.
    // Sendoff recap runs every poll (guarded once per room).
    await postFinals(supabase, summary);
    // YouTube highlights REMOVED — the search returned junk (video-game sims,
    // betting shows, ad clips) and embeds threw Error 153. Pregame heads-up
    // stays (it's templated, reliable).
    if (new Date().getUTCMinutes() % 5 === 0) {
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
    .gte("start_time", threeHoursAgo)
    // A game that has not started cannot be final. Without this, a row with a
    // FUTURE start_time that got wrongly marked final is always inside the
    // "gte threeHoursAgo" window, so it never ages out and re-posts a bogus
    // final every 6 hours forever. Seen in production 2026-08-07: two Week 2
    // September games carrying the Aug 6 Panthers/Cardinals score.
    .lte("start_time", new Date(now).toISOString());
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
      // Rooms that get a real recap don't need this line as well. The Coach's
      // postgame recap already opens with the score and now carries the
      // leaders and the true season record, so this arrived underneath it
      // saying the same thing in fewer words — two posts, one fact.
      //
      // It stays for rooms the recap doesn't serve, where a bare final is
      // better than a game that just stops.
      const { data: huddles } = await supabase
        .from("huddles").select("id, is_official_team_huddle").eq("team_id", team.id);
      const willGetRecap = (huddles ?? []).some((h: any) => !h.is_official_team_huddle);
      if (willGetRecap) continue;
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
  const knownHome = !!lookupTeam(g.home.fullName, g.home.name, index, g.league);
  const knownAway = !!lookupTeam(g.away.fullName, g.away.name, index, g.league);
  const homeKey = g.home.fullName.toLowerCase();
  const awayKey = g.away.fullName.toLowerCase();
  const homeShort = g.home.name.toLowerCase();
  const awayShort = g.away.name.toLowerCase();
  if (!knownHome && !knownAway) return false;
  if (testMode && testTeam) {
    return homeKey.includes(testTeam) || awayKey.includes(testTeam)
        || homeShort.includes(testTeam) || awayShort.includes(testTeam);
  }
  return true;
}

// ESPN's League ("NCAAF"/"NCAAB") and our teams.league ("NCAA") are not the
// same vocabulary. Both college leagues live under one DB league.
function dbLeagueFor(league: League): string {
  return league === "NCAAF" || league === "NCAAB" ? "NCAA" : league;
}

// Preferred lookup. Tries the league-scoped keys first — those are safe even
// for shared nicknames like "Panthers" — then falls back to the global keys,
// which only exist for names unique across every league.
function lookupTeam(
  fullName: string,
  shortName: string,
  index: Map<string, { id: string; name: string; league: string }>,
  league: League,
): { id: string; name: string; league: string } | null {
  const lg = dbLeagueFor(league);
  const full = String(fullName ?? "").toLowerCase().trim();
  const short = String(shortName ?? "").toLowerCase().trim();
  return index.get(`${lg}::${full}`)
    ?? index.get(`${lg}::${short}`)
    ?? index.get(full)
    ?? index.get(short)
    ?? null;
}
