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

    // Only scoring plays are emission candidates.
    if (!play.pointsScored || play.pointsScored <= 0) {
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
