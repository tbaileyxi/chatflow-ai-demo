// Bot Engine v2 — normalized data types.
// IRON RULE: every fact downstream layers see must flow through these shapes.
// Providers (ESPN, Highlightly, …) normalize INTO these. Nothing downstream
// knows which provider produced the data.

export type League = "NBA" | "NFL" | "NCAAF" | "NCAAB" | "MLB" | "NHL";

export type GameStatus = "scheduled" | "in_progress" | "halftime" | "final";

export interface TeamSide {
  // Provider-specific team id (string for portability across providers).
  providerId: string;
  // Resolved Supabase team id when we can match by name. May be null in some leagues.
  teamId: string | null;
  name: string;            // e.g. "Knicks"
  fullName: string;        // e.g. "New York Knicks"
  abbreviation?: string;   // e.g. "NYK"
  score: number;
}

export interface Game {
  providerId: string;           // ESPN event id, etc.
  league: League;
  status: GameStatus;
  startTime: string;            // ISO
  home: TeamSide;
  away: TeamSide;
  period: number | null;        // quarter/half/inning
  clock: string | null;         // display clock from provider
  winProbHome: number | null;   // 0..1 if provider supplies it
}

// A single play / event in chronological order within a game.
// Providers vary: NBA has shot-level events, NFL has drives + plays, MLB has at-bats.
export interface PlayEvent {
  providerId: string;           // stable id within the game
  game: Game;
  occurredAt: string;           // ISO
  // Provider's primary classification — keep as raw string; brain normalizes.
  rawType: string;
  // Human description from the provider.  Never sent verbatim to the bot —
  // brain extracts facts from it, the model only sees facts.
  description: string;
  // Best-effort fields.  Brain skips streak-type facts when absent rather
  // than fabricating them (IRON RULE: mouth, not eyes).
  scoringTeamProviderId?: string;
  pointsScored?: number;
  scoreAfter?: { home: number; away: number };
  period?: number;
  clock?: string;
  scorerName?: string;          // e.g. "Stephen Curry"
}

export interface BoxScore {
  game: Game;
  // Per-team scoring breakdown by period for run/streak detection.
  periodScores: { home: number[]; away: number[] };
}

export interface SportsDataProvider {
  name: string;
  liveGames(league: League): Promise<Game[]>;
  gameEvents(gameProviderId: string, league: League): Promise<PlayEvent[]>;
  boxScore?(gameProviderId: string, league: League): Promise<BoxScore | null>;
  winProbability?(gameProviderId: string, league: League): Promise<number | null>;
}

// ---------------------------------------------------------------
// Fact payload — the structured thing the brain hands to the voice.
// The model rephrases these fields ONLY. Anything not here cannot be said.
// ---------------------------------------------------------------
export interface InGameFacts {
  event:
    | "scoring_play"
    | "three_pointer"
    | "touchdown"
    | "field_goal"
    | "home_run"
    | "goal"
    | "run"
    | "lead_change"
    | "period_change"
    | "final";
  scorer?: string;
  pointsScored?: number;
  scoreLine: string;                  // e.g. "Knicks 88, Spurs 85"
  gameTime: string;                   // e.g. "3:40 Q4"
  winProbSwingPct?: number;           // |Δ win prob| * 100, integer
  runText?: string;                   // e.g. "12-0 run"
  leadChangeNote?: string;            // e.g. "Knicks first lead of the half"
  excitementScore: number;
  // Optional surgical enrichment from Highlightly. Voice may reference these
  // fields verbatim or skip them. Strings only — pre-formatted in code so the
  // model never computes percentages or makes up numbers.
  teamShootingLine?: string;          // e.g. "15/38 3PT (39%)"
  rivalShootingLine?: string;
}

export interface NewsFacts {
  headline: string;                   // original title — model rephrases only
  source: string;
  category: string;                   // HIGH / MED / LOW
  link: string;
  breaking: boolean;
  published_at?: string;              // tense anchor — when the story ran
  now?: string;                       // tense anchor — current time
}

export type BotMode = "in_game" | "news";

export interface VoicePayload {
  mode: BotMode;
  team: string;                       // full name, e.g. "New York Knicks"
  rival?: string;                     // opposing team for in_game
  persona: string;                    // single pro-fan voice for now
  facts: InGameFacts | NewsFacts;
}
