// Bot Engine v2 — news pipeline.
// 4 gates, cheapest first: category -> subject -> cluster -> LLM judge.
// LLM judge is bypassed when category is HIGH or cluster_size >= 3 (cost guard).
// IRON RULE: never store or emit the article body. Title + source + link only.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { judgeHeadline } from "./voice.ts";

export interface RssEntry {
  entryId: string;          // stable id from RSS guid or hash(link)
  title: string;
  link: string;
  source: string;           // best-effort outlet name
  publishedAt: string | null;
}

export interface ScoredEntry extends RssEntry {
  category: "HIGH" | "MED" | "LOW" | "DROP";
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

export function categoryGate(title: string): "HIGH" | "MED" | "LOW" | "DROP" {
  const t = title.toLowerCase();
  for (const k of LOW_DROP) {
    if (t.includes(k)) return "DROP";
  }
  for (const k of HIGH) {
    if (t.includes(k)) return "HIGH";
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
    const clusterSize = await computeCluster(client, teamId, e.title);

    // Cheap signals: HIGH category OR cluster_size >= 3 bypass the LLM judge.
    const bypassJudge = category === "HIGH" || clusterSize >= 3;
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
  // Base by category.
  let s = category === "HIGH" ? 85 : category === "MED" ? 50 : 25;
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
    });
  }
  return items;
}

function pickTag(body: string, tag: string): string | null {
  const m = body.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, "i"));
  return m ? m[1] : null;
}
function pickAttr(body: string, tag: string, attr: string): string | null {
  const m = body.match(new RegExp(`<${tag}[^>]*\\s${attr}="([^"]+)"`, "i"));
  return m ? m[1] : null;
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
