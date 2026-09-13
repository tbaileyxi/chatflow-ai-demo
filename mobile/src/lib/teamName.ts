/**
 * What to call a team on a scoreline.
 *
 * BROADCAST USES THE PLACE, NOT THE MASCOT. Every scorebug you have ever seen
 * says OSU · MICH, not Buckeyes · Wolverines; Kansas City, not Chiefs. Ours
 * said the nickname everywhere, which is why "Green Wave at Wildcats" read as
 * a riddle instead of a game.
 *
 * The `city` column is already the right word in both cases — it holds the
 * SCHOOL for college ("Ohio State", "VMI", "Adams State") and the city or
 * region for pro ("New England", "Kansas City").
 *
 * THE ONE EXCEPTION is a shared city, and it is the reason this needs a
 * resolver rather than a field: "New York" is the Mets and the Yankees, "Los
 * Angeles" is the Chargers and the Rams. When two teams in the SAME league
 * share a city, both fall back to the nickname — which is also exactly what
 * broadcast does. Across leagues there is no clash: the Bears are the only
 * Chicago team in the NFL, so a Bears game says Chicago.
 */
export function makeTeamNamer(
  teams: { id: string; city?: string | null; name?: string | null; league?: string | null }[],
) {
  // How many teams in this league claim this place.
  const claims = new Map<string, number>();
  for (const t of teams) {
    const place = (t.city ?? "").trim();
    if (!place) continue;
    const key = `${(t.league ?? "").trim()}|${place.toLowerCase()}`;
    claims.set(key, (claims.get(key) ?? 0) + 1);
  }

  const byId = new Map(teams.map((t) => [t.id, t]));

  return (id: string | null | undefined): string => {
    if (!id) return "TBD";
    const t = byId.get(id);
    if (!t) return "TBD";

    const place = (t.city ?? "").trim();
    const nick = (t.name ?? "").trim();
    if (!place) return nick || "TBD";

    const key = `${(t.league ?? "").trim()}|${place.toLowerCase()}`;
    const shared = (claims.get(key) ?? 0) > 1;
    return shared ? nick || place : place;
  };
}
