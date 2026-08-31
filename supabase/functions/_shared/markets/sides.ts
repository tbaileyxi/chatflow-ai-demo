// How a market is worded on a card: the eyebrow, the neutral headline, and the
// two sides you can take.
//
// WHY THIS EXISTS: this logic was written three times — in useFadeMarkets, in
// the fade-post-props edge function, and not at all on the Picks board, which
// fell back to raw "YES 30¢ / NO 70¢". So the same Pirates game read as
// "Covers +4.5" in the Fade sheet and "YES" on the board. Moneyline survived
// two separate removals for the same reason: N copies, N places to forget.
//
// One derivation, one dialect. The edge-function twin lives at
// mobile/src/lib/marketSides.ts — the runtimes can't share a
// file, so change both or neither.
//
// The dialect: never YES/NO. A side is named by what happens in the game
// ("Pirates by 5+", "Over 7.5"), because that is the sentence people already
// say out loud. YES/NO is the exchange's word for it, not a fan's.

export type MarketSides = {
  eyebrow: string; // "SPREAD" — what kind of line this is
  headline: string; // "Pirates 4.5 runs" — neutral; never repeats a side
  yesLabel: string; // the YES side, in game words
  noLabel: string; // the NO side, in game words
};

type MarketLike = {
  question?: string | null;
  market_type?: string | null;
  metadata?: Record<string, any> | null;
};

// "Over 7.5 runs scored" / "Pirates wins by over 4.5 runs" -> "runs"
function unitOf(question: string): string {
  return question.match(/(?:over|under)\s+[\d.]+\s+([a-z]+)/i)?.[1] ?? "";
}

// Kalshi lines are half-points, so "over 4.5" is plainly "5 or more".
/**
 * Smallest whole margin that COVERS `line`.
 *
 * The magnitude is what matters, and only the magnitude. A spread reaches us
 * signed from the sportsbook's point of view — the favourite lays -2.5, the
 * underdog takes +2.5 — but both describe the same 2.5-point gap, and the team
 * named in the market is the one that has to beat it either way.
 *
 * Taking `Math.floor` of a negative line produced a label that means nothing:
 * a Patriots room-mate looking at "Patriots -2.5" was offered "Patriots by -2+".
 * Covering -2.5 is winning by 3, so the answer is 3 whichever sign it arrives
 * with.
 */
function atLeast(line: number): number {
  return Math.floor(Math.abs(line)) + 1;
}

/**
 * @param teams  The two teams in the game, in any order. Used only to name the
 *   NO side of a spread. A spread is quoted from the favourite, so the same
 *   card lands in both teams' rooms saying "Patriots -2.5" — and a Browns fan
 *   backing the Browns had to pick a button reading "Anything less", the only
 *   one that didn't mention a team. Naming the other side fixes that without
 *   touching which outcome is which: the market still asks whether the team it
 *   names covers, and yes is still yes.
 */
export function marketSides(m: MarketLike, teams?: (string | null | undefined)[]): MarketSides {
  const q = (m.question ?? "").trim();
  const meta = m.metadata ?? {};
  const type = m.market_type ?? "other";
  const raw = meta.line ?? meta.spread ?? null;
  const line = raw == null ? null : Number(raw);
  const unit = unitOf(q);
  // A handful of Kalshi series are phrased downward ("under 4.5"). The YES side
  // is whatever the series asks, so flip the words rather than the outcome.
  const flipped = String(meta.strike_type ?? "").toLowerCase() === "less";
  const over = line == null ? "Over" : `Over ${line}`;
  const under = line == null ? "Under" : `Under ${line}`;

  if (type === "total" && line != null) {
    return {
      eyebrow: "TOTAL",
      headline: `Total ${line}${unit ? ` ${unit}` : ""}`,
      yesLabel: flipped ? under : over,
      noLabel: flipped ? over : under,
    };
  }

  if (type === "spread" && line != null) {
    // "Pirates wins by over 4.5 runs" -> the team is the subject of the clause.
    const team =
      q.match(/^(.+?)\s+wins?\s+by/i)?.[1]?.trim() ||
      String(meta.side ?? "").match(/^(.+?)\s+wins?\s+by/i)?.[1]?.trim() ||
      q.split(/\s+/)[0] ||
      "Favorite";
    const n = atLeast(line);
    // The other team, when we know it and it isn't the one the market names.
    // Loose match: the market's subject is scraped out of the question text and
    // may be shorter than the row in `teams` ("Patriots" vs "New England
    // Patriots"), so containment either way counts as the same club.
    const norm = (s: string) => s.toLowerCase().trim();
    const isSubject = (t: string) =>
      norm(t) === norm(team) || norm(t).includes(norm(team)) || norm(team).includes(norm(t));
    const other = (teams ?? []).find((t): t is string => !!t && !isSubject(t)) ?? null;
    // No unit on the button — the headline above already carries it, and the
    // longer label broke mid-word inside the fade card's button.
    const by = `${team} by ${n}+`;
    return {
      eyebrow: "SPREAD",
      headline: `${team} ${line}${unit ? ` ${unit}` : ""}`,
      yesLabel: by,
      // Name the other team when we can. Falls back to the old wording, which
      // was deliberately vague because the NO side really does win on a smaller
      // margin AND on a loss — but "Anything less" told a Browns fan nothing
      // about whether it was their side.
      noLabel: other ? `${other} +${Math.abs(line)}` : "Anything less",
    };
  }

  if (type === "player_prop" && line != null) {
    const who = meta.player ?? q.replace(/\s+over\s+[\d.]+.*$/i, "").trim();
    const stat = String(meta.stat ?? "")
      .replace(/^batting_|^pitching_/, "")
      .replace(/_/g, " ");
    const noun = stat || unit || q.match(/over\s+[\d.]+\s+(.+?)\?/i)?.[1] || "";
    return {
      eyebrow: "PROP",
      headline: `${who} ${line}${noun ? ` ${noun}` : ""}`.trim(),
      yesLabel: flipped ? under : over,
      noLabel: flipped ? over : under,
    };
  }

  if (type === "winner") {
    const team = q.match(/will\s+(?:the\s+)?(.+?)\s+win\??$/i)?.[1]?.trim();
    return {
      eyebrow: "MONEYLINE",
      headline: team ? `${team} to win` : q.replace(/\?$/, ""),
      yesLabel: team ? `${team} win` : "They win",
      noLabel: team ? `${team} lose` : "They lose",
    };
  }

  // Unknown series. Show the question as written rather than guessing at it.
  return {
    eyebrow: String(type).replace(/_/g, " ").toUpperCase(),
    headline: q.replace(/\?$/, ""),
    yesLabel: "Yes",
    noLabel: "No",
  };
}
