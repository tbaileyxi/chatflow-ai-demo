// Bot Engine v2 — brain. Turns play-by-play into derived facts + excitement score.
// IRON RULE: every number here is computed in code. The model never invents stats.
// If the data doesn't support a fact (e.g. shot-level events missing), SKIP it.

import type { Game, InGameFacts, League, PlayEvent, TeamSide } from "./types.ts";

// Tunable weights — defaults are NBA-shaped. Reasonable for other leagues.
// Override via env if needed without code changes.
const W_CLOSE  = num("W_CLOSE",  0.25);
const W_LATE   = num("W_LATE",   0.20);
const W_MAG    = num("W_MAG",    0.20);
const W_SWING  = num("W_SWING",  0.20);
const W_STREAK = num("W_STREAK", 0.10);
const W_CLUTCH = num("W_CLUTCH", 0.05);

export const EXCITEMENT_THRESHOLD = num("EXCITEMENT_THRESHOLD", 60);
export const PUSH_THRESHOLD       = num("PUSH_THRESHOLD",       80);

function num(name: string, fallback: number): number {
  const v = Deno.env.get(name);
  if (!v) return fallback;
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// ---------------------------------------------------------------
// Per-game running context. The poller hands us all plays it has fetched
// so far this poll; we compare against state recorded in seen_events and
// against the in-memory window of recent plays to detect runs / lead changes.
// ---------------------------------------------------------------

export interface GatedEvent {
  play: PlayEvent;
  facts: InGameFacts;
  scoringSide: "home" | "away";
  team: TeamSide;
  rival: TeamSide;
  shouldPush: boolean;
}

export function gateEvents(allPlaysChronological: PlayEvent[]): GatedEvent[] {
  if (allPlaysChronological.length === 0) return [];
  const game = allPlaysChronological[0].game;
  const out: GatedEvent[] = [];
  let lastLeader: "home" | "away" | "tie" = "tie";
  let runHome = 0;
  let runAway = 0;

  for (const play of allPlaysChronological) {
    if (!play.scoreAfter) continue;
    const { home, away } = play.scoreAfter;
    const margin = Math.abs(home - away);
    const leader: "home" | "away" | "tie" =
      home > away ? "home" : away > home ? "away" : "tie";

    // Update simple running run counter per side.
    if (play.pointsScored && play.scoringTeamProviderId) {
      const isHome = play.scoringTeamProviderId === game.home.providerId;
      if (isHome) { runHome += play.pointsScored; runAway = 0; }
      else        { runAway += play.pointsScored; runHome = 0; }
    } else {
      // Stoppages/timeouts/turnovers reset the run.
      runHome = runHome; // intentional no-op — only scoring plays reset
    }

    // Scoring plays are candidates — and so are the handful of non-scoring
    // plays a room reacts to anyway.
    //
    // This was scoring-only, which meant that in a scoreless game the bot said
    // NOTHING. Colorado kicked off at Georgia Tech and eight minutes of live
    // football produced 1,311 plays, 0 posts, because the score was 0-0. That
    // is exactly the stretch when a room is loudest and the app was silent.
    //
    // Deliberately narrow: a turnover, a turnover on downs, a safety, or a
    // genuinely long play. These are rare and loud. Everything else — first
    // downs, punts, incompletions — stays quiet, because a bot that narrates
    // every snap gets muted and then it never gets to say the thing that
    // mattered.
    const moment = !play.pointsScored || play.pointsScored <= 0
      ? bigNonScoringMoment(play, game.league)
      : null;

    if ((!play.pointsScored || play.pointsScored <= 0) && !moment) {
      lastLeader = leader;
      continue;
    }

    if (moment) {
      // No points changed hands, so there is no scoring side. Attribute to the
      // team the provider credits with the play, falling back to home, and let
      // the description carry the story.
      const mTeam = play.scoringTeamProviderId === game.away.providerId
        ? game.away
        : game.home;
      const mRival = mTeam === game.home ? game.away : game.home;
      out.push({
        play,
        facts: {
          event: moment.note,
          scoreLine: scoreLineText(game, play.scoreAfter),
          gameTime: gameTimeText(play, game.league),
          play: (play.description || "").slice(0, 200) || undefined,
          excitementScore: moment.weight,
        } as InGameFacts,
        team: mTeam,
        rival: mRival,
        shouldPush: false,
      });
      lastLeader = leader;
      continue;
    }

    const isHomeScoring = play.scoringTeamProviderId === game.home.providerId;
    const scoringSide: "home" | "away" = isHomeScoring ? "home" : "away";
    const team  = isHomeScoring ? game.home : game.away;
    const rival = isHomeScoring ? game.away : game.home;
    const runText = (() => {
      const r = isHomeScoring ? runHome : runAway;
      if (r >= 8) return `${r}-0 run`;
      return undefined;
    })();
    const leadChangeNote = (() => {
      if (lastLeader === "tie" && leader !== "tie") {
        return `${team.name} take the lead`;
      }
      if (lastLeader !== "tie" && leader !== "tie" && lastLeader !== leader) {
        return `${team.name} lead change`;
      }
      return undefined;
    })();

    const closeness    = closenessScore(margin, game.league);
    const timeLeverage = timeLeverageScore(play.period, play.clock, game.league);
    const playMag      = playMagnitudeScore(play, game.league);
    const swing        = winProbSwingScore(margin, play.pointsScored, game.league);
    const streak       = runText ? 1 : 0;
    const clutch       = leadChangeNote ? 1 : 0;

    const excitement = Math.round(100 * (
      W_CLOSE  * closeness +
      W_LATE   * timeLeverage +
      W_MAG    * playMag +
      W_SWING  * swing +
      W_STREAK * streak +
      W_CLUTCH * clutch
    ));

    // A touchdown always talks.
    //
    // Excitement weights closeness at 0.25 and late-game leverage at 0.20, so
    // in a 21-0 second quarter both are near zero and even a touchdown scores
    // in the twenties against a bar of 60. USC scored three times and the room
    // went silent — 63 plays gated. The formula was letting the scoreline veto
    // the score, which is exactly backwards for someone sitting in their team's
    // room watching a rout.
    //
    // Football only, and only six points or more. Every made basket in
    // basketball is a score, and a run crosses the plate in most innings; those
    // sports need the gate. A touchdown is rare enough to be worth saying out
    // loud every single time.
    const isTouchdown =
      (game.league === "NFL" || game.league === "NCAAF") &&
      (play.pointsScored ?? 0) >= 6;

    if (excitement >= EXCITEMENT_THRESHOLD || isTouchdown) {
      const facts: InGameFacts = {
        event: classifyEvent(play, game.league),
        scorer: play.scorerName,
        pointsScored: play.pointsScored,
        scoreLine: scoreLineText(game, play.scoreAfter),
        gameTime: gameTimeText(play, game.league),
        // The real ESPN play text — names the actual player and what happened.
        // This replaces the fake "win probability swing" heuristic, which was
        // meaningless and repetitive.
        play: (play.description || "").slice(0, 200) || undefined,
        leadChangeNote,
        excitementScore: excitement,
      };
      out.push({
        play,
        facts,
        scoringSide,
        team,
        rival,
        shouldPush: excitement >= PUSH_THRESHOLD,
      });
    }

    lastLeader = leader;
  }

  return out;
}

// ---------------------------------------------------------------
// Sub-scorers.  Each returns 0..1.
// Degrade gracefully when data is missing — never fabricate.
// ---------------------------------------------------------------

function closenessScore(margin: number, league: League): number {
  const ref = league === "NFL" || league === "NCAAF" ? 21 : league === "MLB" ? 6 : 25;
  if (margin >= ref) return 0;
  return 1 - margin / ref;
}

function timeLeverageScore(period: number | undefined, clock: string | undefined, league: League): number {
  if (typeof period !== "number") return 0.3;
  const totalPeriods =
    league === "NBA" || league === "NCAAB" ? 4 :
    league === "NFL" || league === "NCAAF" ? 4 :
    league === "NHL" ? 3 :
    league === "MLB" ? 9 : 4;
  const periodFrac = Math.min(1, period / totalPeriods);
  if (!clock) return periodFrac;
  // Inside last 2 minutes of any period boosts further; final period max boost.
  const m = clock.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return periodFrac;
  const remainingSec = Number(m[1]) * 60 + Number(m[2]);
  const inLastTwo = remainingSec <= 120 ? 1 : 0;
  return Math.min(1, periodFrac + (period === totalPeriods ? inLastTwo * 0.3 : inLastTwo * 0.1));
}

function playMagnitudeScore(play: PlayEvent, league: League): number {
  const p = play.pointsScored ?? 0;
  if (league === "NBA" || league === "NCAAB") {
    if (p >= 3) return 1.0;     // three-pointer
    if (p === 2) return 0.5;
    if (p === 1) return 0.2;
    return 0;
  }
  if (league === "NFL" || league === "NCAAF") {
    if (p >= 6) return 1.0;     // touchdown
    if (p === 3) return 0.5;    // field goal
    if (p > 0)  return 0.3;
    return 0;
  }
  if (league === "MLB") {
    if (p >= 3) return 1.0;
    if (p > 0)  return 0.6;
    return 0;
  }
  if (league === "NHL") return p > 0 ? 1.0 : 0;
  return p > 0 ? 0.5 : 0;
}

function winProbSwingScore(margin: number, pointsScored: number, league: League): number {
  // Cheap heuristic when provider doesn't give win prob: closer game + bigger play = bigger swing.
  const closeness = closenessScore(margin, league);
  return Math.min(1, closeness * (pointsScored >= 3 ? 0.8 : 0.4));
}

// ---------------------------------------------------------------
// Cosmetic helpers — what to call the event in the fact payload.
// The voice layer reshapes again; this is just structured classification.
// ---------------------------------------------------------------

function classifyEvent(play: PlayEvent, league: League): InGameFacts["event"] {
  const p = play.pointsScored ?? 0;
  if (league === "NBA" || league === "NCAAB") {
    if (p >= 3) return "three_pointer";
    return "scoring_play";
  }
  if (league === "NFL" || league === "NCAAF") {
    if (p >= 6) return "touchdown";
    if (p === 3) return "field_goal";
    return "scoring_play";
  }
  if (league === "MLB") return p >= 4 ? "home_run" : "scoring_play";
  if (league === "NHL") return "goal";
  return "scoring_play";
}

function scoreLineText(game: Game, scoreAfter: { home: number; away: number }): string {
  return `${game.away.name} ${scoreAfter.away}, ${game.home.name} ${scoreAfter.home}`;
}

function gameTimeText(play: PlayEvent, league: League): string {
  if (!play.period) return play.clock ?? "";
  const periodLabel = (() => {
    if (league === "NBA" || league === "NCAAB" || league === "NFL" || league === "NCAAF") return `Q${play.period}`;
    if (league === "NHL") return `P${play.period}`;
    if (league === "MLB") return `Inn ${play.period}`;
    return `P${play.period}`;
  })();
  return play.clock ? `${play.clock} ${periodLabel}` : periodLabel;
}

/**
 * The non-scoring plays worth interrupting a conversation for.
 *
 * Football only. Basketball scores every possession and baseball turns over
 * every half-inning, so those sports already have plenty for the gate to chew
 * on; gridiron can go a quarter without points and still be gripping.
 */
function bigNonScoringMoment(
  play: PlayEvent,
  league: string,
): { note: string; weight: number } | null {
  if (league !== "NFL" && league !== "NCAAF") return null;
  const t = `${play.rawType ?? ""} ${play.description ?? ""}`.toLowerCase();
  if (!t.trim()) return null;

  // A turnover is a possession and the room knows it instantly.
  if (/\bintercept(ed|ion)\b/.test(t)) return { note: "Interception", weight: 85 };
  if (/fumble/.test(t) && /(recovered|forced)/.test(t)) return { note: "Fumble", weight: 80 };
  if (/turnover on downs/.test(t)) return { note: "Turnover on downs", weight: 75 };
  if (/\bsafety\b/.test(t)) return { note: "Safety", weight: 80 };

  // A long play empties a couch whether or not it reaches the end zone.
  const yards = /\bfor (\d{1,3}) yard/.exec(t);
  if (yards && Number(yards[1]) >= 40) {
    return { note: `${yards[1]}-yard play`, weight: 70 };
  }

  // ── THE GAMECAST TIER ──────────────────────────────────────────────────────
  //
  // Everything above is loud enough to deserve a voice. Everything below is
  // just worth KNOWING — the room was silent for ten minutes between scores,
  // which is the stretch a gamecast exists to fill.
  //
  // Weights are deliberately under the voice threshold (INGAME_VOICE_MIN,
  // default 70), so these always render as ESPN's own sentence and never as
  // the bot having an opinion. That is the whole point: more plays, not more
  // narration.
  //
  // TIGHT ON PURPOSE. First downs are STILL excluded — roughly forty a game,
  // one every ninety seconds, which would push the actual conversation off the
  // screen. A bot that narrates every snap gets muted, and then it never gets
  // to say the thing that mattered. The tier below fills the gap between
  // scores without going that far: explosive gains and third downs are perhaps
  // a dozen a game, and each one is a thing somebody in the room would say out
  // loud.
  if (/\bsack(ed)?\b/.test(t)) return { note: "Sack", weight: 45 };
  // A DRIVE, NOT JUST ITS ENDING.
  //
  // Buffalo scored at 8:28, 8:42 and 9:04 and the room heard nothing in
  // between — twenty minutes of silence three times over, because everything
  // between touchdowns was filtered out. A gamecast that only speaks when
  // points change is a scoreboard, and the room already has one at the top of
  // the screen.
  //
  // These are the plays that move a drive rather than end it. Still under the
  // voice threshold, so they arrive as the provider's own sentence and never
  // as the bot having a take about a 12-yard completion.
  const gain = /\bfor (\d{1,3}) yard/.exec(t);
  if (gain && Number(gain[1]) >= 20) {
    return { note: `${gain[1]}-yard gain`, weight: 50 };
  }
  if (/\b3rd down\b|\bthird down\b/.test(t)) return { note: "Third down", weight: 45 };
  if (/\b4th down\b|\bfourth down\b/.test(t)) return { note: "Fourth down", weight: 55 };
  if (/\bfield goal\b.*\b(no good|missed|blocked)\b/.test(t)) {
    return { note: "Missed field goal", weight: 60 };
  }
  if (/\bpunt(s|ed)?\b/.test(t) && /\bblocked\b/.test(t)) {
    return { note: "Blocked punt", weight: 65 };
  }
  // Inside the twenty is where a drive becomes points or nothing.
  if (/\bto the [A-Z]{2,4} (\d|1[0-9]|20)\b/.test(play.description ?? "")) {
    return { note: "Red zone", weight: 40 };
  }
  return null;
}
