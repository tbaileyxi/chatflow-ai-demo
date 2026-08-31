// Bot Engine v2 — news pipeline.
// 4 gates, cheapest first: category -> subject -> cluster -> LLM judge.
// LLM judge is bypassed when category is HIGH or cluster_size >= 3 (cost guard).
// RULE: use only what the feed provides for syndication — title, the feed's own
// short description/summary (so the bot can convey the actual news, not just
// tease the headline), source, link, image. Never scrape the full article body,
// and never persist the summary (it's passed to the model in-memory only).

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { judgeHeadline } from "./voice.ts";

export interface RssEntry {
  entryId: string;          // stable id from RSS guid or hash(link)
  title: string;
  link: string;
  source: string;           // best-effort outlet name
  publishedAt: string | null;
  imageUrl: string | null;  // Source 2: action photo pulled inline from the feed XML
  summary: string | null;   // feed-provided synopsis so the bot conveys the actual news
}

export interface ScoredEntry extends RssEntry {
  category: "HIGH" | "POP" | "MED" | "LOW" | "DROP";
  llmScore: number | null;  // null when bypassed
  finalScore: number;       // 0..100, used to rank
  breaking: boolean;
  clusterSize: number;
}

// ---------------------------------------------------------------
// Gate 1: category. Free, keyword rules over the title.
// ---------------------------------------------------------------

const HIGH = [
  "trade", "traded", "signs", "signed", "signing", "agrees to",
  "injury", "injured", "out for", "tear", "torn", "surgery",
  "suspension", "suspended",
  "fires", "fired", "hires", "hired", "coaching",
  "commit", "commits", "commitment",                  // recruiting
  "record", "milestone", "all-time",
  "clinches", "clinched", "eliminated", "championship",
  "wins", "defeats", "beats",                         // result, weighed lower in subject gate
];

const LOW_DROP = [
  "odds", "spread", "moneyline", "props", "best bets", "fantasy",
  "takeaways", "things we learned", "winners and losers",
  "slideshow", "gallery", "rumor mill", "what to watch",
];

// Retail / merch / affiliate listings that the Google News feed surfaces as
// "news" (e.g. "Jarvis Landry custom sewn jerseys available in adult sizes M
// through 2XL"). These are shopping results, not stories — drop them outright so
// the bot never posts an ad, and the sponsor whisper never lands on one.
// Phrases are deliberately commerce-distinctive: bare "jersey" is avoided
// because it collides with "New Jersey" and "retire his jersey" (a real story).
const RETAIL_DROP = [
  "available in", "for sale", "on sale", "% off", "percent off",
  "discount", "promo code", "coupon", "where to buy", "best deals",
  "shop the", "shop now", "buy now", "order your", "order now", "get your",
  "custom sewn", "custom jersey", "custom jerseys", "merch", "merchandise",
  "memorabilia", "adult sizes", "youth sizes", "gift guide",
];

// The stuff that actually travels. A uniform reveal, a viral clip, a tunnel
// walk — none of it contains "trade" or "injury", so it scored MED (50) and
// died under the 55 threshold, while the drop list explicitly killed "gallery"
// and "slideshow", which is the exact shape visual content arrives in. The
// pipeline was tuned to reject the only news anyone forwards.
const POP = [
  "uniform", "uniforms", "jersey reveal", "throwback", "helmet", "alternate",
  "viral", "goes viral", "reaction", "mic'd up", "miked up", "hype video",
  "trailer", "tunnel", "celebration", "walkout", "entrance", "crowd",
  "student section", "tradition", "rivalry week", "trophy", "mascot",
  "goes off", "breaks the internet", "insane", "unreal", "must see",
  // Recruiting is the other thing fans follow daily and it rarely uses the
  // hard-news verbs. "commit" is already HIGH; everything before the commit —
  // the offer, the visit, the rankings chatter — was scoring MED and dying.
  "recruit", "recruiting", "five-star", "5-star", "four-star", "4-star",
  "offer", "offers", "official visit", "decommit", "flips", "transfer portal",
  "signing day", "top target", "prospect",
];

// A Yankees room does not want Triple-A Syracuse walk-offs or a 2028 high
// school right-hander's commitment, and it was getting both — the team feeds
// carry affiliate and recruiting wire copy alongside the major league club.
// College rooms DO want recruiting, so this only fires on the minor league
// vocabulary that has no college equivalent.
const FARM_DROP = [
  "triple-a", "double-a", "high-a", "single-a", "milb", "minor league",
  "rookie ball", "instructional league", "class of 20",
];

export function categoryGate(title: string): "HIGH" | "POP" | "MED" | "LOW" | "DROP" {
  {
    const t0 = title.toLowerCase();
    for (const k of FARM_DROP) if (t0.includes(k)) return "DROP";
  }
  const t = title.toLowerCase();
  // Ads are always out — a shopping listing is never news.
  for (const k of RETAIL_DROP) {
    if (t.includes(k)) return "DROP";
  }
  // Hard news first: a signing is a signing even if it mentions a jersey.
  for (const k of HIGH) {
    if (t.includes(k)) return "HIGH";
  }
  // POP is checked BEFORE the low-value list on purpose. "Photo gallery: the
  // new alternates" is exactly the post fans share, and the old order dropped
  // it on the word "gallery" before anything else got a look.
  for (const k of POP) {
    if (t.includes(k)) return "POP";
  }
  for (const k of LOW_DROP) {
    if (t.includes(k)) return "DROP";
  }
  return "MED";
}

// ---------------------------------------------------------------
// Gate 2: subject vs mention. Team is SUBJECT if its name appears in
// the first 60 chars of the title or before a colon. Otherwise DROP
// for league-roundup style mentions.
// ---------------------------------------------------------------

export function subjectGate(title: string, teamNameTokens: string[]): boolean {
  const head = title.slice(0, 60).toLowerCase();
  return teamNameTokens.some((t) => t.length >= 3 && head.includes(t.toLowerCase()));
}

// ---------------------------------------------------------------
// Gate 2b: the big club, not the farm system.
//
// Team blogs (SB Nation and friends) cover affiliates in the same feed as the
// parent club, so a room for the Yankees got a Triple-A Scranton box score. The
// naive fix — listing every team's affiliates — is 30 lists per league that go
// stale every time an affiliation changes. These are LEVEL markers instead:
// they name the tier, not the team, so one list covers every club in the sport.
//
// A story only clears this gate if it mentions no minor-league level at all, OR
// it is a roster move that IS major-club news. A call-up is the big club's news
// even though the sentence says Triple-A, and dropping those would lose real
// stories.
// ---------------------------------------------------------------

const MINOR_LEVEL = [
  // baseball tiers + the minor leagues themselves
  "triple-a", "triple a", "double-a", "double a", "single-a", "single a",
  "high-a", "low-a", "class a", "rookie ball", "rookie league",
  "minor league", "minor-league", "the minors", "farm system", "farmhand",
  "international league", "pacific coast league", "eastern league",
  "southern league", "texas league", "midwest league", "california league",
  "carolina league", "florida state league", "south atlantic league",
  "northwest league", "arizona fall league", "complex league",
  // other sports
  "g league", "g-league", "ahl", "echl", "juniors", "reserve team",
];

// Roster moves that mention the minors but are unambiguously big-club news.
const MAJOR_MOVE = [
  "call-up", "called up", "calls up", "recalled", "promoted",
  "rehab assignment", "optioned", "designated for assignment", "dfa",
  "sent down", "demoted", "roster move", "activated",
];

export function bigClubGate(title: string, summary?: string | null): boolean {
  const text = `${title} ${summary ?? ""}`.toLowerCase();
  if (!MINOR_LEVEL.some((m) => text.includes(m))) return true;
  return MAJOR_MOVE.some((m) => text.includes(m));
}

// ---------------------------------------------------------------
// Gate 3: dedupe + cluster. Cluster by normalized title prefix across
// today's already-seen entries for this team. Cluster size is a signal,
// not a reason to drop.
// ---------------------------------------------------------------

function normalizeTitle(t: string): string {
  return t
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

export async function computeCluster(client: SupabaseClient, teamId: string, title: string): Promise<number> {
  const key = normalizeTitle(title);
  if (!key) return 1;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data } = await client
    .from("seen_news")
    .select("title")
    .eq("team_id", teamId)
    .gte("created_at", since)
    .limit(50);
  if (!data) return 1;
  let n = 1;
  for (const row of data) {
    const k2 = normalizeTitle(row.title);
    if (k2 && (k2.startsWith(key.slice(0, 40)) || key.startsWith(k2.slice(0, 40)))) n++;
  }
  return n;
}

// ---------------------------------------------------------------
// Pipeline entrypoint. Run the gates, return ranked survivors.
// `team` is the canonical team name string. `tokens` are the team
// name tokens to match against (e.g. ["Knicks","New York"]).
// ---------------------------------------------------------------

export interface ScoreOptions {
  team: string;
  tokens: string[];
  threshold: number;           // NEWS_SCORE_THRESHOLD, default 55
}

export async function scoreEntries(
  client: SupabaseClient,
  teamId: string,
  entries: RssEntry[],
  opts: ScoreOptions,
): Promise<ScoredEntry[]> {
  const out: ScoredEntry[] = [];
  for (const e of entries) {
    const category = categoryGate(e.title);
    if (category === "DROP") continue;
    if (!subjectGate(e.title, opts.tokens)) continue;
    // Free, and it runs BEFORE the judge on purpose: HIGH-category headlines
    // skip the judge entirely, and a minor-league recap reads as HIGH because
    // it contains "beats"/"wins". That bypass is how a Scranton box score
    // reached a Yankees room.
    if (!bigClubGate(e.title, e.summary)) continue;
    const clusterSize = await computeCluster(client, teamId, e.title);

    // Cheap signals: HIGH category OR cluster_size >= 3 bypass the LLM judge.
    const bypassJudge = category === "HIGH" || category === "POP" || clusterSize >= 3;
    let llmScore: number | null = null;
    let breaking = false;
    if (!bypassJudge) {
      const judged = await judgeHeadline(opts.team, e.title, e.source);
      if (judged) {
        llmScore = judged.score;
        breaking = judged.breaking;
      } else {
        // judge unavailable -> fall back to category-only signal
        llmScore = null;
      }
    } else {
      breaking = category === "HIGH";
    }

    const finalScore = computeFinalScore(category, clusterSize, llmScore);
    if (finalScore < opts.threshold && !breaking) continue;
    out.push({ ...e, category, llmScore, finalScore, breaking, clusterSize });
  }
  // Highest first.
  out.sort((a, b) => b.finalScore - a.finalScore);
  return out;
}

function computeFinalScore(
  category: ScoredEntry["category"],
  clusterSize: number,
  llmScore: number | null,
): number {
  // Base by category. POP sits just above the 55 threshold so a viral post
  // survives on its own, but below HIGH so a trade still outranks a uniform.
  let s = category === "HIGH" ? 85 : category === "POP" ? 70 : category === "MED" ? 50 : 25;
  // Cluster boost — caps quickly so we don't double-count a swarm.
  s += Math.min(15, (clusterSize - 1) * 5);
  // Blend in judge score when available.
  if (typeof llmScore === "number") {
    s = Math.round((s + llmScore) / 2);
  }
  return Math.max(0, Math.min(100, s));
}

// ---------------------------------------------------------------
// News silence helper. Suppress all news for a team from
// NEWS_QUIET_BEFORE_TIPOFF_MIN before tipoff through final.
// Caller provides the team's next game (start ISO + status).
// ---------------------------------------------------------------

export function isNewsQuietWindow(opts: {
  nextGameStartIso: string | null;
  nextGameStatus: string | null;
}): boolean {
  if (!opts.nextGameStartIso) return false;
  if (opts.nextGameStatus === "in_progress" || opts.nextGameStatus === "halftime") return true;
  const quietMin = Number(Deno.env.get("NEWS_QUIET_BEFORE_TIPOFF_MIN") || 30);
  const minsUntilStart = (new Date(opts.nextGameStartIso).getTime() - Date.now()) / 60000;
  return minsUntilStart > 0 && minsUntilStart <= quietMin;
}

// ---------------------------------------------------------------
// Minimal RSS parser. We accept either RSS 2.0 (<item>) or Atom (<entry>).
// Stable entry id: <guid> / <id> / sha-ish hash of link.
// ---------------------------------------------------------------

export function parseRss(xml: string, fallbackSource: string): RssEntry[] {
  const items: RssEntry[] = [];
  const itemBlocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];
  const entryBlocks = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)];
  const blocks = itemBlocks.length ? itemBlocks : entryBlocks;
  for (const m of blocks) {
    const body = m[1];
    const title = pickTag(body, "title");
    const linkRss = pickTag(body, "link");
    const linkAtom = pickAttr(body, "link", "href");
    const link = linkAtom || linkRss;
    const guid = pickTag(body, "guid") || pickTag(body, "id");
    const pub = pickTag(body, "pubDate") || pickTag(body, "updated") || pickTag(body, "published");
    const source = pickTag(body, "source") || fallbackSource;
    if (!title || !link) continue;
    const entryId = guid || `hash:${hash16(link)}`;
    items.push({
      entryId,
      title: stripCdata(title).trim(),
      link: stripCdata(link).trim(),
      source: stripCdata(source).trim(),
      publishedAt: pub ? new Date(stripCdata(pub).trim()).toISOString() : null,
      imageUrl: extractRssImage(body),
      summary: extractRssSummary(body, stripCdata(title).trim()),
    });
  }
  return items;
}

function pickTag(body: string, tag: string): string | null {
  const m = body.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, "i"));
  return m ? m[1] : null;
}

// Pull a short SYNOPSIS from the feed item so the bot can convey what actually
// happened instead of teasing the headline. Feeds publish this in
// <description>/<summary>/<content:encoded> for syndication — it's meant to be
// shown. Strips HTML, decodes entities, drops boilerplate, caps length. Returns
// null when the feed only echoes the title (e.g. bare Google News items).
function extractRssSummary(body: string, title: string): string | null {
  const raw =
    pickTag(body, "description") ||
    pickTag(body, "summary") ||
    pickTag(body, "content:encoded") ||
    pickTag(body, "content");
  if (!raw) return null;
  let text = stripCdata(raw)
    .replace(/<[^>]+>/g, " ")                 // strip tags
    .replace(/&#0*38;|&amp;/g, "&")
    .replace(/&#0*39;|&apos;|&rsquo;|&#8217;/g, "’")
    .replace(/&quot;|&#0*34;/g, '"')
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&hellip;|&#8230;/g, "…")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")          // drop any other entities
    .replace(/\s+/g, " ")
    .trim();
  // Drop SB-Nation/outlet boilerplate that sometimes leads the description.
  text = text.replace(/^continue reading[…\.]*/i, "").trim();
  if (!text) return null;
  // If the description is just the headline echoed, it adds nothing.
  if (text.toLowerCase().startsWith(title.toLowerCase().slice(0, 40))) {
    const rest = text.slice(title.length).trim();
    if (rest.length < 30) return null;
  }
  if (text.length < 30) return null;            // too thin to be a real synopsis
  return text.length > 320 ? text.slice(0, 317).trimEnd() + "…" : text;
}
function pickAttr(body: string, tag: string, attr: string): string | null {
  const m = body.match(new RegExp(`<${tag}[^>]*\\s${attr}="([^"]+)"`, "i"));
  return m ? m[1] : null;
}

// Source 2: pull an inline image URL from a feed item. Good outlet feeds (CBS,
// many others) embed the article's action photo right in the XML via
// <media:content>, <media:thumbnail>, or an image <enclosure> — full-res, no
// scraping. Returns null for image-less feeds (e.g. Google News), which then
// stay text-only. Junk (logos/svg/non-http) is filtered out.
function extractRssImage(body: string): string | null {
  const candidates: (string | null)[] = [
    pickAttr(body, "media:content", "url"),
    pickAttr(body, "media:thumbnail", "url"),
    // <enclosure> only counts when it's actually an image.
    /(<enclosure[^>]*type="image\/)/i.test(body)
      ? pickAttr(body, "enclosure", "url")
      : null,
    // Last resort: an <img src> inside the description/content HTML.
    (body.match(/<img[^>]+src="([^"]+)"/i) || [])[1] || null,
  ];
  for (const raw of candidates) {
    if (!raw) continue;
    const url = decodeEntities(stripCdata(raw)).trim();
    if (!/^https:\/\//i.test(url)) continue;          // RN needs https
    if (/\.svg(\?|$)/i.test(url)) continue;
    if (/logo|sprite|favicon|placeholder|avatar|1x1|spacer/i.test(url)) continue;
    return url;
  }
  return null;
}

// Feed img URLs come HTML-encoded (e.g. SB Nation: "?quality=90&#038;strip=all").
// React Native's <Image> needs the raw "&" or the query string breaks. Decode
// the ampersand entities (named, decimal, hex).
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#0*38;/g, "&")
    .replace(/&#x0*26;/gi, "&");
}
function stripCdata(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}
function hash16(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36).padStart(8, "0").slice(0, 12);
}

// ---------------------------------------------------------------
// Source 2 — news action photo. Fetch the article's OpenGraph hero image
// (og:image / twitter:image). For real outlets this is a Getty/AP ACTION shot,
// not a headshot — exactly the "player turning it up" visual we want on a news
// post. Defensive: 5s timeout, junk filter, never throws (returns null).
// IRON RULE stays intact: we read one <meta> URL, never the article body.
// ---------------------------------------------------------------
// Returns the article's OG image AND description from a single request.
//
// The description matters as much as the photo: Google News RSS items carry a
// headline and nothing else, so the bot has no facts to relay and can only
// re-tease the headline ("Colorado is looking at an elite QB prospect" —
// without ever naming him). That reads as clickbait because it literally is
// the clickbait, rephrased. og:description is the article's own summary and
// usually contains the name, number or detail the headline withholds.
export async function fetchOgMeta(
  url: string,
): Promise<{ image: string | null; description: string | null }> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        // Some outlets gate bots; a real UA gets the OG tags reliably.
        "User-Agent":
          "Mozilla/5.0 (compatible; SideHuddleBot/1.0; +https://sidehuddlesports.com)",
      },
    });
    clearTimeout(timer);
    if (!res.ok) return { image: null, description: null };
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("html")) return { image: null, description: null };
    // Only need the <head>; cap the read so we never pull a huge page.
    const html = (await res.text()).slice(0, 200_000);

    const meta = (key: string): string | null => {
      // Attribute order varies (property|name first OR content first).
      const a = html.match(
        new RegExp(
          `<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']+)["']`,
          "i",
        ),
      );
      if (a) return a[1];
      const b = html.match(
        new RegExp(
          `<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${key}["']`,
          "i",
        ),
      );
      return b ? b[1] : null;
    };

    let img =
      meta("og:image:secure_url") ||
      meta("og:image") ||
      meta("twitter:image") ||
      meta("twitter:image:src");

    // The article's own summary. This is the payload that lets the bot state
    // the actual news instead of re-teasing the headline.
    let desc =
      meta("og:description") ||
      meta("twitter:description") ||
      meta("description");
    if (desc) {
      desc = desc.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
      // Guard against a description that is just the headline echoed back, or
      // a boilerplate site tagline — neither adds a fact.
      if (desc.length < 40) desc = null;
    }

    if (img) {
      img = img.replace(/&amp;/g, "&").trim();
      if (!/^https:\/\//i.test(img)) img = null;               // require https (RN image-safe)
      else if (/\.svg(\?|$)/i.test(img)) img = null;            // vector logos, not photos
      // Drop obvious non-action assets: site chrome, default share images, avatars.
      else if (/logo|sprite|favicon|placeholder|default[-_]?(share|image)|avatar|1x1|spacer/i.test(img)) {
        img = null;
      }
    }
    return { image: img ?? null, description: desc ?? null };
  } catch {
    // offline / abort / parse fail — news still posts, just text-only
    return { image: null, description: null };
  }
}

// Back-compat wrapper for callers that only want the photo.
export async function fetchOgImage(url: string): Promise<string | null> {
  return (await fetchOgMeta(url)).image;
}
