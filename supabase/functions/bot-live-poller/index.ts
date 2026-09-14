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
import { generateMessage, plainLine, defaultPersona } from "../_shared/bot/voice.ts";
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
    x_queued: 0,         // plays queued to look for a clip later
    x_due: 0,            // queued plays whose wait was up this run
    x_gave_up: 0,        // queued plays that ran out of retries
    x_duplicate: 0,      // clip already in the room, skipped
    x_search_failed: 0,  // xAI call itself failed — NOT the same as finding nothing
    x_attempts: 0,       // searches actually made this run
    x_claim_failed: 0,   // seen_events claim rejected (another runner, or a constraint)
    x_citations: 0,      // post URLs xAI came back with
    x_no_media: 0,       // read the posts, none carried a photo or video
    excitement_seen: [] as number[], // scores of plays we emitted, to sanity-check the clip bar
    targets_built: 0,
    skipped_not_covered: 0,
    // Games where ESPN served a live clock but zero plays, and what we did.
    x_fallback_attempts: 0,
    x_fallback_posts: 0,
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
      // Active only. Opponent placeholders (status 'inactive') exist so a
      // scoreboard can print "San Jose State" instead of the word "Away"; they
      // are not teams we cover, and pulling them in here would have the bot
      // fetching play-by-play for every game in the country to then discard it.
      .select("id, name, city, league, highlightly_display_name")
      .eq("status", "active");
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

    // Only cover teams that have a room somebody is actually IN.
    //
    // This used to poll every team with any huddle at all — 195 seeded
    // Community rooms, 88 live plays a day into rooms nobody had opened. The
    // first fix narrowed it to teams with a non-official room, which helped
    // but was wrong in both directions: it still covered user rooms with zero
    // members, and it EXCLUDED official rooms that people had genuinely
    // joined, so anyone sitting in a team's Community room got no live
    // narration at all.
    //
    // Membership is the honest test, and it's the same one publish() applies
    // before writing. Checking it here means a team nobody is watching never
    // reaches the model, so it costs nothing rather than costing a generation
    // that gets thrown away.
    const [membersRes, roomsRes] = await Promise.all([
      supabase.from("huddle_members").select("huddle_id"),
      supabase.from("huddles").select("id, team_id").not("team_id", "is", null),
    ]);
    const occupiedHuddleIds = new Set(
      (membersRes.data ?? []).map((m: any) => m.huddle_id),
    );
    const coveredTeams = new Set(
      (roomsRes.data ?? [])
        .filter((r: any) => occupiedHuddleIds.has(r.id))
        .map((r: any) => r.team_id),
    );
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
      // Ops readout of the clips themselves — public X links and media URLs,
      // no room names and no message text. Needed because "a clip landed" and
      // "a clip played" are different claims and only one of them was checked.
      const { data: clipRows } = await supabase
        .from("huddle_messages")
        .select("created_at, media_url, media_type, embed_code")
        .eq("message_type", "live_play")
        .like("embed_code", "https://x.com/%")
        .order("created_at", { ascending: false })
        .limit(10);
      (summary as any).clips = (clipRows ?? []).map((r: any) => ({
        at: r.created_at?.slice(11, 16),
        type: r.media_type,
        media: r.media_url,
        post: r.embed_code,
      }));
    }


    // ESPN reachability probe. games_seen: 0 is ambiguous on its own — it reads
    // the same whether there are genuinely no games or ESPN refused us. This
    // reports the raw HTTP status so the two can be told apart from the summary
    // alone, without needing function logs.

    for (const league of summary.leagues) {
      const games = await provider.liveGames(league);
      summary.games_seen += games.length;

      const followed = games.filter((g) => matchedTeam(g, teamIndex, TEST_MODE, TEST_TEAM));
      summary.games_with_followed_team += followed.length;

      for (const game of followed) {
        if (game.status !== "in_progress" && game.status !== "halftime") continue;

        // ASK THE CHEAP ENDPOINT FIRST.
        //
        // liveGames() is one scoreboard call per LEAGUE and already carries
        // the score. gameEvents() is one call per GAME, every poll — fourteen
        // games on an NFL Sunday, every ninety seconds, unkeyed, from a
        // datacenter IP. ESPN already 403s Supabase on site.api; there is no
        // reason to keep testing their patience for an answer we have.
        //
        // A game whose score has not moved since the last poll has nothing we
        // would narrate, so it does not get opened. Halftime is skipped for
        // the same reason: the score cannot change during it.
        //
        // FAILING OPEN IS DELIBERATE. Any error reading or writing the cursor
        // falls through to fetching, because one wasted request is a much
        // cheaper mistake than a missed touchdown.
        const scoreNow = `${game.away?.score ?? 0}-${game.home?.score ?? 0}`;
        let skip = false;
        try {
          const { data: cur } = await supabase
            .from("poller_game_cursor")
            .select("last_score, last_status")
            .eq("game_provider_id", game.providerId)
            .maybeSingle();
          if (cur && cur.last_score === scoreNow && cur.last_status === game.status) {
            skip = true;
          } else {
            await supabase.from("poller_game_cursor").upsert(
              {
                game_provider_id: game.providerId,
                last_score: scoreNow,
                last_status: game.status,
                seen_at: new Date().toISOString(),
              },
              { onConflict: "game_provider_id" },
            );
          }
        } catch (err) {
          console.warn("[live-poller] cursor unavailable, fetching anyway", err);
        }
        if (skip) {
          summary.games_unchanged = (summary.games_unchanged ?? 0) + 1;
          continue;
        }

        const plays = await provider.gameEvents(game.providerId, league);
        summary.plays_fetched += plays.length;

        // ESPN can serve a live game's score and clock and NO plays at all.
        //
        // Colorado at Georgia Tech played a full first quarter — a missed field
        // goal, a turnover, a goal-line stop — while this endpoint returned
        // count: 0, and five other live games returned 41 to 145 plays from the
        // identical call. The bot cannot filter what it never receives, so the
        // room sat silent through the loudest part of the night and looked
        // broken to everybody in it.
        //
        // When the play feed is empty on a game somebody actually has a room
        // for, ask X what is happening rather than saying nothing. Rate-limited
        // hard: one post per game per eight-minute bucket, and only while the
        // feed stays empty — the moment ESPN starts serving plays, the normal
        // path takes over and this stops firing.
        if (plays.length === 0) {
          // Resolve to OUR team rows the same way the scoring path does.
          // game.home/away are TeamSide, whose Supabase id is `teamId` and not
          // `id` — reading `.id` off them silently yields undefined and the
          // coverage check can then never match anything.
          const sides = [
            {
              db: lookupTeam(game.home?.fullName, game.home?.name, teamIndex, league),
              rival: game.away?.fullName ?? game.away?.name ?? "",
            },
            {
              db: lookupTeam(game.away?.fullName, game.away?.name, teamIndex, league),
              rival: game.home?.fullName ?? game.home?.name ?? "",
            },
          ].filter((x: any) => x.db?.id && coveredTeams.has(x.db.id)) as any[];
          if (sides.length > 0) {
            // Two reasons to speak, and the scoreline is the urgent one.
            //
            // A pure time bucket meant Georgia Tech could score and the room
            // heard nothing for eight minutes, which is the opposite of the
            // point. So: post whenever the SCORE has changed since we last
            // spoke, and otherwise at most once per eight minutes so a long
            // scoreless stretch still gets a word.
            // ONE reason to speak per cycle, and never twice for the same thing.
            //
            // This tried the scoreline key and then FELL THROUGH to a time
            // bucket when the scoreline was already claimed — so the same
            // kickoff return got narrated three separate times in one room,
            // each poll finding the score key taken and posting on the timer
            // instead. A bot that repeats itself is worse than one that is
            // quiet.
            //
            // So: a new scoreline speaks immediately. Otherwise nothing is
            // said unless the room has heard nothing about this game for ten
            // minutes. The floor applies to BOTH paths, so no combination of
            // keys can produce two posts back to back.
            const scoreState = `${game.away?.score ?? 0}-${game.home?.score ?? 0}`;
            const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
            const { data: recentFb } = await supabase
              .from("seen_events")
              .select("id")
              .eq("game_id", game.providerId)
              .like("event_id", "xfallback:%")
              .gte("emitted_at", tenMinAgo)
              .limit(1);
            const spokeRecently = (recentFb ?? []).length > 0;

            // Claiming the scoreline tells us whether this score is new to us.
            const { error: scoreClaimErr } = await supabase
              .from("seen_events")
              .insert({
                game_id: game.providerId,
                event_id: `xfallback:score:${scoreState}`,
                team_id: sides[0].db.id,
                emitted: true,
                emitted_at: new Date().toISOString(),
              });
            const scoreIsNew = !scoreClaimErr;

            let claimed = scoreIsNew;
            if (!scoreIsNew && !spokeRecently) {
              const bucket = Math.floor(Date.now() / (10 * 60 * 1000));
              const { error: idleErr } = await supabase
                .from("seen_events")
                .insert({
                  game_id: game.providerId,
                  event_id: `xfallback:idle:${bucket}`,
                  team_id: sides[0].db.id,
                  emitted: true,
                  emitted_at: new Date().toISOString(),
                });
              claimed = !idleErr;
            }
            if (claimed) {
              summary.x_fallback_attempts = (summary.x_fallback_attempts ?? 0) + 1;
              const label = `${game.away?.fullName ?? game.away?.name} at ${game.home?.fullName ?? game.home?.name}`;
              const r = await searchX(
                `${label} — college football, in progress right now. What has ` +
                `actually happened in this game so far: scoring, turnovers, ` +
                `missed kicks, fourth-down stops, injuries. Report only what is ` +
                `being said about THIS game tonight, most recent first. If you ` +
                `cannot find anything about it, say exactly that.`,
                { mode: "news", recencyHours: 6, maxTokens: 500 },
              );
              if (r.ok && r.text && r.text.trim().length > 40) {
                for (const side of sides) {
                  const voiced = await generateMessage({
                    persona: defaultPersona(side.db.name, league),
                    mode: "in_game",
                    team: side.db.name,
                    rival: side.rival,
                    facts: {
                      event: "Live update",
                      gameTime: `${game.away?.name} at ${game.home?.name}`,
                      play: r.text.slice(0, 600),
                    } as any,
                  });
                  const result = await publish({
                    client: supabase,
                    teamId: side.db.id,
                    teamName: side.db.name,
                    mode: "in_game",
                    message: voiced.message,
                    facts: { event: "Live update" } as any,
                    shouldPush: false,
                  });
                  summary.posts += result.huddleIdsPosted.length;
                  summary.x_fallback_posts =
                    (summary.x_fallback_posts ?? 0) + result.huddleIdsPosted.length;

                  // Queue the video too.
                  //
                  // Clips hang off gated plays, and a game ESPN serves no plays
                  // for never produces one — so the room that most needed a
                  // highlight (the one with no play feed at all) was the only
                  // one guaranteed not to get one. A score is a score whether
                  // or not ESPN told us about it, and processPendingClips does
                  // not care where the row came from.
                  //
                  // Score changes only. An idle "still 7-7" update has no
                  // highlight to find, and asking for one burns the budget on
                  // a question with no answer.
                  if (scoreIsNew && Deno.env.get("X_API_BEARER_TOKEN") && result.huddleIdsPosted.length > 0) {
                    const delayMin = Number(Deno.env.get("XLIVE_DELAY_MIN") || 5);
                    const { error: qErr } = await supabase.from("pending_clips").insert({
                      game_provider_id: game.providerId,
                      play_key: `xfallback:score:${scoreState}`,
                      team_id: side.db.id,
                      team_name: side.db.name,
                      opponent: side.rival,
                      scorer: null,
                      play_text: r.text.slice(0, 300),
                      huddle_ids: result.huddleIdsPosted,
                      search_after: new Date(Date.now() + delayMin * 60000).toISOString(),
                    });
                    if (!qErr) summary.x_queued += 1;
                  }
                }
              }
            }
          }
        }

        if (plays.length === 0) continue;

        // NARRATE ONLY THE GAME WE THINK WE ARE NARRATING.
        //
        // Every play carries the game ESPN built it from, out of the summary
        // header. The outer `game` came from the scoreboard. Those are supposed
        // to be the same fixture, and when they are not, the bot stitches one
        // game's team names onto another game's score — brain.ts does exactly
        // that in scoreLineText(game, play.scoreAfter).
        //
        // A Mets room got "8-2 Brewers but this is tagged as us taking the lead,
        // which doesn't add up" — the model spotted the contradiction and said so
        // out loud, in a room, to users. Chourio is a Brewer; the header said
        // Padres at Mets.
        //
        // Cheap to check and it fails closed: say nothing rather than say
        // something wrong about somebody else's game.
        const playGame = plays[0]?.game;
        if (playGame) {
          const same = (a?: string, b?: string) =>
            !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
          const matches =
            (same(playGame.home?.name, game.home?.name) &&
              same(playGame.away?.name, game.away?.name)) ||
            (same(playGame.home?.fullName, game.home?.fullName) &&
              same(playGame.away?.fullName, game.away?.fullName));
          if (!matches) {
            const msg =
              `[live-poller] play/game mismatch for providerId ${game.providerId}: ` +
              `scoreboard says ${game.away?.name} @ ${game.home?.name}, ` +
              `plays say ${playGame.away?.name} @ ${playGame.home?.name} — skipping`;
            console.error(msg);
            summary.errors.push(msg);
            continue;
          }
        }

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

            // IS THIS WORTH A MODEL?
            //
            // Decided HERE, before any enrichment, because the box score
            // fetch, the leaders backstop, the NBA shooting call and the
            // recent-lines query exist for one reason: feeding the prompt. On
            // a routine play they are all work done to fill a request we are
            // no longer going to make.
            //
            // 70 sits between the clip bar (65) and the push bar (80).
            // Excitement already weights closeness and late-game leverage, so
            // this is "the moments a room would look up for" rather than a
            // fixed share of plays — a blowout produces almost none and a
            // one-score fourth quarter produces most of them.
            const VOICE_MIN = Number(Deno.env.get("INGAME_VOICE_MIN") || 70);
            const worthAVoice = (g.facts.excitementScore ?? 0) >= VOICE_MIN;

            // Real box-score stat leaders for ALL sports (ESPN). This is the
            // smart-bot fuel: "Brunson 31 PTS, 7 AST" / "Soto 3 H, 2 RBI".
            // Only fetched when a model is going to read it.
            if (worthAVoice) try {
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
            if (worthAVoice && league === "NBA" && Deno.env.get("HIGHLIGHTLY_API_KEY")) {
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

            // What this bot already said in this team's rooms. Only matters
            // when a model is writing — a plain line is ESPN's own text and
            // cannot wander into repeating itself.
            if (worthAVoice) try {
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

            // The plain line is also the FALLBACK. If the model fails or comes
            // back empty, a room that just saw a touchdown gets ESPN's
            // sentence rather than silence.
            const free = plainLine(enrichedFacts);
            let voice: { message: string; provider: string; model: string };
            if (worthAVoice) {
              voice = await generateMessage({
                mode: "in_game",
                team: dbTeam.name,
                rival: t.opponent,
                persona,
                facts: enrichedFacts,
              });
              if (!voice.message?.trim() && free) {
                voice = { message: free, provider: "espn", model: "play-text" };
              }
            } else if (free) {
              voice = { message: free, provider: "espn", model: "play-text" };
            } else {
              // No play text to fall back on — nothing to say for free, and
              // this play did not clear the bar for paying. Skip it.
              continue;
            }
            summary.voiced = (summary.voiced ?? 0) + (worthAVoice ? 1 : 0);
            summary.free_lines = (summary.free_lines ?? 0) + (worthAVoice ? 0 : 1);

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
            // No per-run cap here any more. Queueing is a row in a table; the
            // money is spent later in processPendingClips, which takes
            // XLIVE_PER_RUN off the queue per poll. Capping both ends meant a
            // second game's touchdown was dropped on the floor rather than
            // waiting its turn.
            const XLIVE_MIN = Number(Deno.env.get("XLIVE_MIN_EXCITEMENT") || 0);
            const XLIVE_PER_GAME = Number(Deno.env.get("XLIVE_PER_GAME") || 3);
            if (
              Deno.env.get("X_API_BEARER_TOKEN") &&
              (g.facts.excitementScore ?? 0) >= XLIVE_MIN &&
              result.huddleIdsPosted.length > 0 &&
              clipsThisGame < XLIVE_PER_GAME
            ) {
              // Queue the clip; do not search yet.
              //
              // The search used to run right here, about two minutes after the
              // play. It found nothing, over and over — 93 attempts all-time
              // against 7 clips — because a highlight of the play does not
              // exist on X yet. Cutting and posting one takes five to fifteen
              // minutes. We were asking before the answer existed, and because
              // the play was claimed at the same moment, we never asked again.
              //
              // So record the play now and look for its video later, more than
              // once. The unique constraint on (game, play, team) is what keeps
              // overlapping runs from queueing the same touchdown twice.
              const delayMin = Number(Deno.env.get("XLIVE_DELAY_MIN") || 5);
              const { error: queueErr } = await supabase.from("pending_clips").insert({
                game_provider_id: game.providerId,
                play_key: t.key,
                team_id: dbTeam.id,
                team_name: dbTeam.name,
                opponent: t.opponent,
                scorer: g.facts.scorer ?? null,
                play_text: g.facts.play ?? null,
                huddle_ids: result.huddleIdsPosted,
                search_after: new Date(Date.now() + delayMin * 60000).toISOString(),
              });
              if (!queueErr) {
                clipsThisGame += 1;
                summary.x_queued += 1;
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
    await processPendingClips(supabase, summary);
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

function decodeEntities(raw: string): string {
  const named: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'", "#x27": "'",
  };
  // &amp;amp; happens when a string is escaped twice upstream, so resolve until
  // it stops changing rather than in a single pass.
  let out = raw, prev = "";
  while (out !== prev) {
    prev = out;
    out = out.replace(/&([a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);/g, (m, e) => {
      if (named[e]) return named[e];
      if (e.startsWith("#x")) return String.fromCodePoint(parseInt(e.slice(2), 16));
      if (e.startsWith("#"))  return String.fromCodePoint(parseInt(e.slice(1), 10));
      return m;
    });
  }
  return out;
}

// Work the clip queue.
//
// A big play is posted the moment it happens; its video shows up on X several
// minutes later. This is the second half: come back for the plays whose wait is
// up, search, and drop the clip into the same rooms that saw the play.
//
// Retries matter more than the first delay. A highlight might land in four
// minutes or in twelve, and one look at a fixed offset will miss half of them.
// So a miss pushes the next look out and costs one of a small number of tries.
async function processPendingClips(supabase: any, summary: any) {
  if (!Deno.env.get("X_API_BEARER_TOKEN")) return;

  const PER_RUN     = Number(Deno.env.get("XLIVE_PER_RUN") || 1);
  const MAX_READS   = Number(Deno.env.get("XLIVE_MAX_READS") || 3);
  const MAX_TRIES   = Number(Deno.env.get("XLIVE_MAX_TRIES") || 3);
  const RETRY_MIN   = Number(Deno.env.get("XLIVE_RETRY_MIN") || 5);

  const { data: due } = await supabase
    .from("pending_clips")
    .select("*")
    .eq("status", "pending")
    .lte("search_after", new Date().toISOString())
    .order("search_after", { ascending: true })
    .limit(PER_RUN);

  if (!due?.length) return;
  summary.x_due = due.length;

  const botUserId = (await supabase.rpc("get_or_create_system_user")).data;

  for (const row of due) {
    // Claim this attempt first. Two overlapping runs reading the same due row
    // would otherwise both pay xAI for the same search.
    const { data: claimed } = await supabase
      .from("pending_clips")
      .update({ attempts: row.attempts + 1 })
      .eq("id", row.id)
      .eq("attempts", row.attempts)
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    summary.x_attempts += 1;

    try {
      // Ask about the GAME, not the single play — naming the exact play was
      // what returned nothing 12 times out of 12. The play is a good reason to
      // go looking and a terrible search term.
      //
      // The room has a side. "Best clip from the game" once put a Blue Jays
      // highlight in a Yankees room: technically responsive, completely wrong.
      const who = row.scorer ? ` Especially ${row.scorer}.` : "";
      const found = await searchX(
        `Find a video or photo of the ${row.team_name} posted in the last two hours, ` +
          `from their game against the ${row.opponent} being played today.${who} ` +
          `It must feature the ${row.team_name} — their players, their bench, their fans, ` +
          `or a play that happened to them. ` +
          `Do NOT return ${row.opponent} highlights or posts celebrating the ${row.opponent}. ` +
          `Ignore previews, predictions, betting picks and old highlights.`,
      );

      // Zero citations has two very different causes and they looked
      // identical from the outside: xAI erroring (bad key, quota, 5xx) returns
      // the same empty shape as xAI genuinely finding no clip. Weeks of "the
      // search comes back empty" could have been either. found.ok separates
      // them, so the next time this is quiet we know which thing to fix.
      if (!found.ok) summary.x_search_failed += 1;

      const ids = [...new Set(
        found.citations.map(postIdFromUrl).filter(Boolean) as string[],
      )].slice(0, MAX_READS);
      summary.x_citations += ids.length;
      summary.x_moment_reads += ids.length;

      const best = ids.length ? pickBest(await fetchPostMedia(ids)) : null;

      // The same clip, twice.
      //
      // Each queued play searches on its own, and X only has so many posts
      // about one game — so two touchdowns five minutes apart both came back
      // with the SAME video, and the room got it twice. The play that found it
      // is not the identity that matters here; the post is.
      //
      // Checked against the rooms this clip is bound for, not globally: the
      // same highlight legitimately belongs in both teams' rooms.
      if (best) {
        const { data: dupe } = await supabase
          .from("huddle_messages")
          .select("id")
          .eq("embed_code", best.url)
          .in("huddle_id", row.huddle_ids ?? [])
          .limit(1)
          .maybeSingle();
        if (dupe) {
          // Not a failure and not worth a retry — this clip is already in the
          // room. Close the play out and let the next one find something new.
          await supabase.from("pending_clips").update({ status: "done" }).eq("id", row.id);
          summary.x_duplicate = (summary.x_duplicate ?? 0) + 1;
          continue;
        }
      }

      if (best) {
        // X serves post text HTML-escaped, so a caption arrived reading
        // "4th &amp; 1". Decoded here rather than at display time because the
        // string is stored, and a stored entity is wrong in every client that
        // ever reads it.
        const quote = decodeEntities(best.text)
          .replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim().slice(0, 140);
        await supabase.from("huddle_messages").insert(
          (row.huddle_ids ?? []).map((hid: string) => ({
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
        await supabase.from("pending_clips").update({ status: "done" }).eq("id", row.id);
        summary.x_moments += 1;
        continue;
      }

      summary.x_no_media += 1;

      // Nothing yet. Either come back, or stop — a play from half an hour ago
      // is not worth posting a clip of even if one finally appears.
      if (row.attempts + 1 >= MAX_TRIES) {
        await supabase.from("pending_clips").update({ status: "gave_up" }).eq("id", row.id);
        summary.x_gave_up += 1;
      } else {
        await supabase.from("pending_clips")
          .update({ search_after: new Date(Date.now() + RETRY_MIN * 60000).toISOString() })
          .eq("id", row.id);
      }
    } catch (err) {
      console.warn("[live-poller] pending clip skipped", err);
    }
  }
}

// Pregame heads-up: when a followed team tips/first-pitches within the next
// ~45 min, drop one "game coming up" message into each of its rooms. Templated
// (no LLM) so it's free and reliable. Guarded per room so it fires once.

/**
 * A push, for the one moment that decides whether an install becomes a user.
 *
 * The pregame notice has always been posted into the room and never pushed, so
 * it only ever reached somebody already looking at the app — the one person who
 * did not need telling. Kickoff is the whole product: if a new user never hears
 * that their team is playing, the install was a single session and whatever
 * channel delivered them was wasted.
 *
 * Recaps already push. This is the same idea at the other end of the game, and
 * the more useful end — a recap is something you missed, a kickoff is something
 * you can still join.
 */
async function pushToRoom(title: string, huddleId: string, body: string): Promise<void> {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return;
  try {
    await fetch(`${url}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        title, body,
        huddle_ids: [huddleId],
        source: "bot_v2",
        notification_type: "bot_drop",
      }),
    });
  } catch (err) {
    console.warn("[pregame] push failed", err);
  }
}

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
        if (!error) {
          summary.pregames = (summary.pregames ?? 0) + 1;

          // AND TELL THEM. The pregame notice has always been posted into the
          // room and never pushed, which means it only reached someone already
          // looking at the app — the one person who did not need telling.
          //
          // Kickoff is the whole product. If an install never hears that their
          // team is playing, it was a one-time visit, and every channel that
          // delivered them was wasted on a single session.
          //
          // Recaps already push. This is the same idea at the other end of the
          // game, and it is the more important end: a recap is something you
          // missed, a kickoff is something you can still join.
          await pushToRoom(`${team.name} vs ${opp.name}`, h.id, `${verb(g.sport_key || "")} at ${time} ET. The room's open.`);
        }
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
  // BY STATE, NOT BY CLOCK.
  //
  // This used to search for finals that started within N hours. Every value of
  // N is wrong: you cannot predict when a game ENDS. Three hours was shorter
  // than a football game. Six still loses one that runs seven. The window was
  // never the right idea — a game has either had its recap or it has not, and
  // that is a fact about the game, so it lives on the game.
  //
  // A delayed game now gets its recap late instead of never.
  const { data: finals } = await supabase
    .from("games")
    .select(
      "id, odds_game_id, status, start_time, sport_key, home_score, away_score, " +
        "home:teams!games_home_team_id_fkey(id, name, city), " +
        "away:teams!games_away_team_id_fkey(id, name, city)",
    )
    .eq("status", "final")
    .is("recap_posted_at", null)
    // A game that has not started cannot be final. Without this, a row with a
    // FUTURE start_time wrongly marked final would post a bogus recap. Seen in
    // production 2026-08-07: two Week 2 September games carrying the Aug 6
    // Panthers/Cardinals score.
    .lte("start_time", new Date(now).toISOString())
    // Belt and braces against a backfill going wrong: nothing older than two
    // days should ever produce a recap, whatever the flag says.
    .gte("start_time", new Date(now - 48 * 60 * 60 * 1000).toISOString());
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
      const won = team.id === home.id ? hs > as : as > hs;
      const body = `🏁 Final: ${away.name} ${as}, ${home.name} ${hs}.${leaderLine} ${won ? "Big one in the books." : "On to the next."}`;
      for (const h of huddles ?? []) {
        // Per ROOM, not per team. This asked whether ANY of the team's rooms
        // would get the Coach's richer recap and, if so, skipped the bare final
        // for ALL of them. UNC has two rooms — one official, one a chapter — so
        // the chapter's existence silenced the official room, and the Tar Heels
        // beat TCU with neither room ever being told the final score. TCU, with
        // a single room, got its recap normally.
        //
        // coach-recap serves rooms where is_official_team_huddle is false or
        // null; this serves the rest. Same split, decided one room at a time.
        if (!h.is_official_team_huddle) continue;
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

    // Served every room this game reaches, so it is done — whatever happens on
    // the next run. This is what replaces the old six-hour dedupe window: the
    // guard is now "has this game been recapped", which cannot expire.
    await supabase
      .from("games")
      .update({ recap_posted_at: new Date().toISOString() })
      .eq("id", g.id);
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

  // Games that finished recently. Six hours from kickoff, for the same
  // reason as the recap above: three is shorter than a football game.
  const sixHourWindow = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data: finals } = await supabase
    .from("games")
    .select(
      "id, status, start_time, home_team_id, away_team_id, " +
        "home:teams!games_home_team_id_fkey(id, name, city), " +
        "away:teams!games_away_team_id_fkey(id, name, city)",
    )
    .eq("status", "final")
    .gte("start_time", sixHourWindow);

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
