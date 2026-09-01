// og-preview — what a Side Huddle link looks like when it lands in a group chat.
//
// THE PROBLEM. vercel.json rewrites every route to index.html, whose OG tags are
// static and generic, and HuddleInvitePage sets its own with react-helmet —
// client-side, after JavaScript runs. iMessage, WhatsApp, Discord, Slack and X
// do not run JavaScript; they fetch the HTML and read what is already in it. So
// every room anyone has ever shared has previewed as a stock image and the words
// "Side Huddle Sports". That is the cheapest marketing surface there is, it
// fires every time a member shares, it works at zero users, and it has been
// showing nothing this whole time.
//
// WHY IT LIVES HERE AND NOT ON VERCEL. Vercel Functions do not run on that
// project: a four-line handler with no imports hangs until timeout. Supabase
// edge functions work — this is the seventh deployed today — and the repo
// already had `og-message` doing exactly this shape for shared messages, plus a
// Cloudflare worker to front it. Same pattern, one fewer moving part.
//
// ONLY CRAWLERS REACH THIS. The Vercel rewrite that points here is gated on a
// user-agent `has` condition, so a person opening the link still gets the app,
// untouched, and Universal Links keep working. That is deliberate: a redirect
// hop for humans would break the thing that makes these links worth sharing.
//
// Deployed with --no-verify-jwt because crawlers cannot authenticate. It reads
// nothing a person holding the link could not already see, and writes nothing.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE = "https://www.sidehuddlesports.com";

// Square, 1024px, already served from the site. Not the 1200x630 a purpose-built
// card would be, but it is real and it unfurls — which the previous og-invite.svg
// did not, because no major platform renders SVG in a preview.
// Slug -> the name the team page actually prints. Mirrors TEAMS in
// src/lib/teams.ts, which is what /t/<slug> renders; a preview that disagrees
// with the page it previews is worse than no preview.
//
// The `teams` TABLE is not the source here, deliberately. It does not carry
// every one of these under the same name — "texas-am", "lsu" and "tcu" all fell
// through to a title-cased slug and previewed as "Texas Am", "Lsu" and "Tcu".
const TEAM_NAMES: Record<string, string> = {
  "cleveland-browns": "Cleveland Browns",
  "buffalo-bills": "Buffalo Bills",
  "texas-am": "Texas A&M",
  "penn-state": "Penn State",
  "ohio-state": "Ohio State",
  "alabama": "Alabama",
  "pittsburgh-steelers": "Pittsburgh Steelers",
  "green-bay-packers": "Green Bay Packers",
  "clemson": "Clemson",
  "georgia": "Georgia",
  "dallas-cowboys": "Dallas Cowboys",
  "seattle-seahawks": "Seattle Seahawks",
  "texas": "Texas Longhorns",
  "las-vegas-raiders": "Las Vegas Raiders",
  "lsu": "LSU",
  "georgia-tech": "Georgia Tech",
  "tcu": "TCU",
  "usc-trojans": "USC Trojans",
  "south-carolina": "South Carolina Gamecocks",
};

/**
 * Serve a room photo from sidehuddlesports.com, not from supabase.co.
 *
 * Apple fetches og:image as a separate request, and it renders the "document"
 * card — raw HTML in the bubble instead of a picture — when that fetch does not
 * satisfy it. The previews that worked pointed at an image on this domain; the
 * ones that broke pointed at Supabase storage, which sits behind Cloudflare bot
 * management (it sets __cf_bm on every response). curl gets a 200 from there;
 * Apple's fetcher is a different client and we cannot see what it gets.
 *
 * Same-origin removes the variable entirely. /room-photo/* is a plain Vercel
 * rewrite onto the same bucket — no function, nothing new to fail.
 */
function sameOrigin(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = "/storage/v1/object/public/room-photos/";
  const i = url.indexOf(marker);
  return i === -1 ? url : `${SITE}/room-photo/${url.slice(i + marker.length)}`;
}

const DEFAULT_IMAGE = `${SITE}/lovable-uploads/4520766b-9c2a-467d-a68c-44031ab9f4ba.png`;

/**
 * The card for a team, or the one that covers everyone else.
 *
 * TEAM_NAMES only has the 19 teams we hand-curated colours for. The teams table
 * carries hundreds across NFL, NCAA and MLB, so a per-team lookup alone leaves
 * most rooms with nothing — which is exactly how a Georgia Tech room ended up
 * on a plain background. The default is not a placeholder; it is the answer for
 * every team we will never write a colour for.
 */
function teamCardImage(teamName: string | null | undefined): string {
  const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (teamName) {
    const wanted = key(teamName);
    const slug = Object.keys(TEAM_NAMES).find(
      (s) => key(TEAM_NAMES[s]) === wanted || key(TEAM_NAMES[s]).includes(wanted),
    );
    if (slug) return `${SITE}/og-teams/${slug}-card.png`;
  }
  return `${SITE}/og-teams/default-card.png`;
}

const esc = (s: string) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * A link preview is LANDSCAPE. A room background is not.
 *
 * huddles.photo_url holds the room's chat background, generated at 828x1792 —
 * phone-wallpaper shape. Feeding that to og:image made every shared room and
 * clip arrive as an extremely tall strip, which is what a broken link looks
 * like to whoever receives one.
 *
 * The same artwork exists at 1200x630 as `-card.png`, the ratio every platform
 * wants. A photo an owner uploaded themselves is left alone — it is theirs, and
 * cropping is the client's job.
 */
function landscape(u: string | null): string | null {
  if (!u) return null;
  return u.includes("/og-teams/") ? u.replace("-room.png", "-card.png") : u;
}


/**
 * The same facts the page shows, written out for a crawler.
 *
 * NOT CLOAKING, and the distinction is the whole design. /t/<slug> renders the
 * live room, the scoreboard and the next fixture to a person; a crawler was
 * getting a title and one sentence. This gives it the same information in plain
 * HTML — different presentation, identical facts. Serving a crawler things a
 * visitor cannot see is what gets a domain penalised, so nothing goes in here
 * that is not on the page.
 *
 * It is also the reason this is worth doing at all: the content changes every
 * game, so the page has a reason to be recrawled instead of sitting static
 * forever.
 */
async function teamBody(
  supabase: ReturnType<typeof createClient>,
  label: string,
): Promise<{ html: string; extra: string }> {
  const bits: string[] = [];
  const facts: string[] = [];
  try {
    const { data: teams } = await supabase
      .from("teams").select("id, name, city").eq("status", "active").limit(600);
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const want = norm(label);
    const team = (teams ?? []).find((x: any) => {
      const k = norm(`${x.city ?? ""}${x.name ?? ""}`);
      return k === want || k.includes(want) || want.includes(k);
    });
    if (!team) return { html: "", extra: "" };

    const cols = "status, start_time, home_score, away_score, home:teams!games_home_team_id_fkey(name), away:teams!games_away_team_id_fkey(name)";
    const mine = `home_team_id.eq.${team.id},away_team_id.eq.${team.id}`;

    const { data: next } = await supabase.from("games").select(cols).or(mine)
      .eq("status", "scheduled").gt("start_time", new Date().toISOString())
      .order("start_time", { ascending: true }).limit(1);
    const { data: last } = await supabase.from("games").select(cols).or(mine)
      .eq("status", "final").order("start_time", { ascending: false }).limit(1);

    const n: any = next?.[0];
    if (n) {
      const when = new Date(n.start_time).toLocaleDateString("en-US",
        { weekday: "long", month: "long", day: "numeric" });
      const line = `Next up: ${n.away?.name} at ${n.home?.name}, ${when}.`;
      bits.push(`<p>${esc(line)}</p>`); facts.push(line);
    }
    const l: any = last?.[0];
    if (l) {
      const line = `Last result: ${l.away?.name} ${l.away_score ?? ""} at ${l.home?.name} ${l.home_score ?? ""}.`;
      bits.push(`<p>${esc(line)}</p>`); facts.push(line);
    }

    // A few lines from the public room — the thing the page actually shows.
    const { data: rooms } = await supabase
      .from("huddles").select("id, name").eq("team_id", team.id)
      .eq("is_private", false)
      .order("is_official_team_huddle", { ascending: false }).limit(1);
    const room: any = rooms?.[0];
    if (room) {
      const { data: msgs } = await supabase
        .from("huddle_messages").select("content")
        .eq("huddle_id", room.id).eq("is_bot_message", true)
        .order("created_at", { ascending: false }).limit(5);
      const lines = (msgs ?? []).map((m: any) => (m.content ?? "").trim())
        .filter(Boolean).slice(0, 5);
      if (lines.length) {
        bits.push(`<h2>${esc(`From the ${room.name} room`)}</h2>`);
        bits.push("<ul>" + lines.map((x: string) => `<li>${esc(x.slice(0, 200))}</li>`).join("") + "</ul>");
      }
    }
  } catch (err) {
    console.warn("[og-preview] team body skipped", err);
  }
  return { html: bits.join("\n"), extra: facts.join(" ") };
}

function page(o: {
  title: string;
  description: string;
  image: string;
  canonical: string;
  /** Real content for the crawler — the same facts the app page shows. */
  body?: string;
  /** Fresh content wants a short cache; a static card does not. */
  maxAge?: number;
}): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" href="${SITE}/favicon.png">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.description)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Side Huddle">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.description)}">
<meta property="og:image" content="${esc(o.image)}">
<meta property="og:image:secure_url" content="${esc(o.image)}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:alt" content="${esc(o.title)}">
<meta property="og:url" content="${esc(o.canonical)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@sidehuddlesports">
<meta name="twitter:title" content="${esc(o.title)}">
<meta name="twitter:description" content="${esc(o.description)}">
<meta name="twitter:image" content="${esc(o.image)}">
<link rel="canonical" href="${esc(o.canonical)}">
</head>
<body style="font-family:-apple-system,system-ui,sans-serif;max-width:34rem;margin:3rem auto;padding:0 1.25rem;">
<img src="${esc(o.image)}" alt="${esc(o.title)}" style="width:100%;border-radius:12px;">
<h1>${esc(o.title)}</h1>
<p>${esc(o.description)}</p>
${o.body ?? ""}
<p><a href="${esc(o.canonical)}">Open in Side Huddle</a></p>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Crawlers re-fetch aggressively and a room's name rarely changes.
      // A page carrying live room content goes stale in minutes; a static card
      // does not. Serving both on an hour's cache told crawlers the fresh pages
      // never change, which is the opposite of what makes them worth recrawling.
      "Cache-Control": `public, max-age=${o.maxAge ?? 300}, s-maxage=${o.maxAge ?? 3600}`,
      "Access-Control-Allow-Origin": "*",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  const url = new URL(req.url);
  const roomId = url.searchParams.get("room");
  const teamSlug = url.searchParams.get("team");
  const inviteCode = url.searchParams.get("invite");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // A generic-but-correct card is always better than a broken one. Every failure
  // below falls through to this rather than erroring, because the preview is the
  // only thing most people will ever see of a shared link.
  const fallback = {
    title: "Side Huddle",
    description:
      "A room for you and your friends, and the game you're all watching.",
    image: DEFAULT_IMAGE,
    canonical: SITE,
  };

  try {
    // An invite link is what the app actually shares — PullInFriendsModal builds
    // https://www.sidehuddlesports.com/i/<code>, not /h/<id>. Sharing a room and
    // getting the generic Side Huddle logo is this route not being covered.
    let resolvedRoom = roomId;
    if (!resolvedRoom && inviteCode) {
      const { data: invite } = await supabase
        .from("room_invites")
        .select("huddle_id")
        .eq("invite_code", inviteCode)
        .maybeSingle();
      resolvedRoom = (invite as any)?.huddle_id ?? null;
      if (!resolvedRoom) return page(fallback);
    }

    if (resolvedRoom) {
      const { data: room } = await supabase
        .from("huddles")
        .select("name, photo_url, member_count, teams:team_id (name)")
        .eq("id", resolvedRoom)
        .maybeSingle();

      if (!room) return page(fallback);

      // SHOW WHAT WAS SHARED, not the room it came from.
      //
      // Every share pointed at /h/<room>, so a clip, a take and a joke all
      // previewed as the same room background. One query parameter fixes it
      // without a new page: ?m=<messageId> swaps the image and the description
      // for that message's own. The link still opens the room, so nothing
      // about the destination changes.
      const sharedId = url.searchParams.get("m");
      let sharedImage: string | null = null;
      let sharedText: string | null = null;
      if (sharedId) {
        const { data: msg } = await supabase
          .from("huddle_messages")
          .select("content, media_url, media_type")
          .eq("id", sharedId)
          .maybeSingle();
        if (msg) {
          sharedText = ((msg as any).content ?? "").trim().slice(0, 180) || null;
          // A video frame is not fetchable as an image, so a clip keeps the
          // room card rather than previewing as a broken image.
          if ((msg as any).media_type === "image" && (msg as any).media_url) {
            sharedImage = sameOrigin((msg as any).media_url);
          }
        }
      }

      const team = (room as any).teams?.name as string | undefined;
      const members = (room as any).member_count as number | null;
      const crowd =
        typeof members === "number" && members > 1
          ? ` ${members} people are already in.`
          : "";

      return page({
        title: `${room.name} · Side Huddle`,
        description: sharedText
          ?? (team
            ? `A ${team} room. Talk through the game with the people in it.${crowd}`
            : `Talk through the game with the people in it.${crowd}`),
        // The room's own photo when it has one — a picture of their bar beats
        // any card we could generate, and it is why the photo shipped first.
        // Their own photo when they have set one; otherwise their team's card.
        image: sharedImage || landscape(sameOrigin((room as any).photo_url)) || teamCardImage(team),
        // Point at the link that was actually shared, so the preview and the
        // destination agree.
        canonical: inviteCode ? `${SITE}/i/${inviteCode}` : `${SITE}/h/${resolvedRoom}`,
      });
    }

    if (teamSlug) {
      const label =
        TEAM_NAMES[teamSlug] ??
        teamSlug
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");

      const extra = await teamBody(supabase, label);

      return page({
        // What people search is "browns game chat", not the brand. The team and
        // the words for the thing come first; the brand goes last.
        title: `${label} game chat — live room · Side Huddle`,
        // The fixture lives in the BODY, not here as well. Putting it in both
        // printed it twice in a row on the rendered page, which reads as
        // stuffing to a reader and to Google.
        description: `${label} fans in one room, talking through the game. The score, the news and the clips land while you argue over them.`,
        image: `${SITE}/og-teams/${TEAM_NAMES[teamSlug] ? teamSlug : "default"}-card.png`,
        canonical: `${SITE}/t/${teamSlug}`,
        body: extra.html,
        // Five minutes. The room content underneath changes every game, and an
        // hour's cache tells a crawler the page is static.
        maxAge: 300,
      });
    }

    return page(fallback);
  } catch (_e) {
    return page(fallback);
  }
});
