// Which sport a team's room is actually about.
//
// A Colorado football room was shown a women's volleyball graphic — "BUFFS
// WIN!", three sets, from @CUBuffsVB. The X search had asked "what are Colorado
// Buffaloes fans talking about", and in a week when the football team had not
// played, the honest answer involved volleyball. The query was never wrong; it
// was just never told which team at the school it meant.
//
// Pro leagues are one sport by definition. A university is not: the same team
// row covers football in the autumn and basketball in the winter, so the answer
// depends on when you ask.

export type SportLabel = "football" | "basketball" | "baseball" | "hockey";

export function sportFromKey(sportKey?: string | null): SportLabel | null {
  if (!sportKey) return null;
  if (sportKey.startsWith("americanfootball")) return "football";
  if (sportKey.startsWith("basketball")) return "basketball";
  if (sportKey.startsWith("baseball")) return "baseball";
  if (sportKey.startsWith("icehockey")) return "hockey";
  return null;
}

// `sportKey` from the team's nearest game is the real answer when we have one.
// The league is the fallback, and for college the month decides: football runs
// August through early January, basketball from November, and the overlap goes
// to football because that is the room people are in.
export function sportFor(league?: string | null, sportKey?: string | null, at = new Date()): SportLabel {
  const known = sportFromKey(sportKey);
  if (known) return known;

  switch ((league ?? "").toUpperCase()) {
    case "NFL": return "football";
    case "NBA": return "basketball";
    case "MLB": return "baseball";
    case "NHL": return "hockey";
  }

  const m = at.getMonth(); // 0-indexed
  if (m >= 7 || m === 0) return "football";   // Aug–Jan
  if (m >= 1 && m <= 3) return "basketball";  // Feb–Apr
  return "football";                          // May–Jul: the next season up
}

// Appended to any X search about a team, so the answer comes back from the
// right program. Without it an athletic department's other 20 teams are all
// equally valid answers.
export function sportScopeLine(teamName: string, sport: SportLabel): string {
  return (
    `This is about the ${teamName} ${sport} team ONLY. ` +
    `Ignore every other sport at the same school or organisation — volleyball, ` +
    `soccer, softball, and the other programs — even when posted by the same ` +
    `athletic department or a school-wide account.`
  );
}
