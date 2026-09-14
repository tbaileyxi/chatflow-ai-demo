// Who is on television, and who is ranked.
//
// Games come from the Odds API, which knows lines and scores and nothing about
// what a person would actually put on. So "the games most people are watching"
// was not a question this database could answer — there was no broadcaster
// column and no poll ranking anywhere.
//
// ESPN publishes both on its public scoreboard, free and without a key:
// competitions[].broadcasts[].names is the network, and each competitor's
// curatedRank.current is the AP position (99 means unranked). This copies those
// two facts onto our rows. It writes nothing else — ESPN is not the source of
// truth for scores here, and two feeds disagreeing about a score is a bug
// factory.
//
// MATCHING. ESPN's `location` and `name` line up with our city and name on
// both sides of the split: NFL is Denver/Broncos, college is Ohio State/
// Buckeyes — which is the same shape our teams table already uses. A fixture
// is then our row with those two team ids whose kickoff is within three hours,
// because the two feeds round start times differently.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// The leagues we carry, as ESPN paths.
const SCOREBOARDS: { path: string; slug: string; league: string }[] = [
  { path: "football/nfl", slug: "nfl", league: "NFL" },
  { path: "football/college-football", slug: "college-football", league: "NCAA" },
  { path: "basketball/nba", slug: "nba", league: "NBA" },
  { path: "basketball/mens-college-basketball", slug: "mens-college-basketball", league: "NCAA" },
  { path: "baseball/mlb", slug: "mlb", league: "MLB" },
  { path: "hockey/nhl", slug: "nhl", league: "NHL" },
];

/**
 * site.api.espn.com REFUSES SUPABASE. All six leagues came back 403 from the
 * edge runtime while answering fine from a laptop, and a browser User-Agent
 * changed nothing — it is the source IP, not the headers.
 *
 * Two other ESPN hosts serve the same scoreboard. cdn.espn.com nests it one
 * level deeper (content.sbData) and is the one that answered; site.web is kept
 * behind it because a single host is a single point of failure and this is a
 * free endpoint we do not control.
 */
async function fetchEvents(board: { path: string; slug: string }): Promise<{
  events: any[];
  via: string;
}> {
  const attempts = [
    {
      via: "cdn",
      url: `https://cdn.espn.com/core/${board.slug}/scoreboard?xhr=1&limit=400`,
      pick: (j: any) => j?.content?.sbData?.events ?? [],
    },
    {
      via: "site.web",
      url: `https://site.web.api.espn.com/apis/site/v2/sports/${board.path}/scoreboard?limit=400`,
      pick: (j: any) => j?.events ?? [],
    },
    {
      via: "site",
      url: `https://site.api.espn.com/apis/site/v2/sports/${board.path}/scoreboard?limit=400`,
      pick: (j: any) => j?.events ?? [],
    },
  ];

  for (const a of attempts) {
    try {
      const res = await fetch(a.url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
          Accept: "application/json",
        },
      });
      if (!res.ok) continue;
      const events = a.pick(await res.json());
      if (Array.isArray(events) && events.length > 0) return { events, via: a.via };
    } catch {
      // Try the next host.
    }
  }
  return { events: [], via: "none" };
}

const THREE_HOURS = 3 * 60 * 60 * 1000;

function norm(v: string | null | undefined): string {
  return (v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: teams } = await supabase
      .from("teams")
      .select("id, name, city, league");

    // city+name is the identity; league disambiguates the handful of schools
    // that share a name with a pro side.
    const byKey = new Map<string, string>();
    for (const t of teams ?? []) {
      byKey.set(`${norm((t as any).league)}|${norm((t as any).city)}|${norm((t as any).name)}`, (t as any).id);
    }

    // Everything in the window the app actually shows, fetched once rather
    // than a query per ESPN event.
    const from = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const to = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString();
    const { data: ours } = await supabase
      .from("games")
      .select("id, home_team_id, away_team_id, start_time")
      .gte("start_time", from)
      .lte("start_time", to);

    const byPair = new Map<string, { id: string; t: number }[]>();
    for (const g of ours ?? []) {
      const k = `${(g as any).home_team_id}|${(g as any).away_team_id}`;
      const list = byPair.get(k) ?? [];
      list.push({ id: (g as any).id, t: new Date((g as any).start_time).getTime() });
      byPair.set(k, list);
    }

    let matched = 0;
    let missed = 0;
    const diag: Record<string, unknown> = {
      teams: (teams ?? []).length,
      ourGames: (ours ?? []).length,
    };

    for (const board of SCOREBOARDS) {
      const { events, via } = await fetchEvents(board);
      diag[board.path] = `${events.length} events via ${via}`;
      if (events.length === 0) continue;

      for (const ev of events) {
        const comp = ev?.competitions?.[0];
        if (!comp) continue;

        const home = comp.competitors?.find((c: any) => c.homeAway === "home");
        const away = comp.competitors?.find((c: any) => c.homeAway === "away");
        if (!home || !away) continue;

        const homeId = byKey.get(
          `${norm(board.league)}|${norm(home.team?.location)}|${norm(home.team?.name)}`,
        );
        const awayId = byKey.get(
          `${norm(board.league)}|${norm(away.team?.location)}|${norm(away.team?.name)}`,
        );
        if (!homeId || !awayId) {
          missed++;
          continue;
        }

        const when = new Date(ev.date).getTime();
        const candidates = byPair.get(`${homeId}|${awayId}`) ?? [];
        const hit = candidates.find((c) => Math.abs(c.t - when) < THREE_HOURS);
        if (!hit) {
          missed++;
          continue;
        }

        // Every network carrying it, in ESPN's order — "ESPN, ABC" for a
        // simulcast. Joined rather than arrayed because the only thing that
        // reads it is a line of text on a card.
        const networks = (comp.broadcasts ?? [])
          .flatMap((b: any) => b?.names ?? [])
          .filter(Boolean);
        const broadcast = networks.length > 0 ? [...new Set(networks)].join(", ") : null;

        // 99 is ESPN's "unranked". Storing it would make every team look like
        // it has a ranking, so it becomes null.
        const rank = (c: any): number | null => {
          const r = c?.curatedRank?.current;
          return typeof r === "number" && r > 0 && r <= 25 ? r : null;
        };

        const { error } = await supabase
          .from("games")
          .update({
            broadcast,
            home_rank: rank(home),
            away_rank: rank(away),
          })
          .eq("id", hit.id);
        if (error) {
          console.log("[espn] update failed", error.message);
          continue;
        }
        matched++;
      }
    }

    return new Response(JSON.stringify({ matched, missed, diag }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[espn] fatal", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
