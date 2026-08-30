// bot-news-poller — fires every 30 minutes via pg_cron.
//
// Flow:
//   1. For each team with at least one active feed, fetch every feed.
//   2. Parse RSS, skip entries we've already seen.
//   3. If the team has a live game (or one inside the quiet window), STAY SILENT.
//   4. Score new entries through the 4 gates. Bypass LLM judge when cheap signals decide.
//   5. Respect NEWS_DAILY_CAP_PER_TEAM. Breaking flag may exceed cap by 1.
//   6. Voice + publish surviving entries.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { searchX } from "../_shared/coach/xsearch.ts";
import { sportFor, sportScopeLine } from "../_shared/sport.ts";
import { fetchOgMeta, isNewsQuietWindow, parseRss, scoreEntries } from "../_shared/bot/news.ts";
import { generateMessage, defaultPersona } from "../_shared/bot/voice.ts";
import { newsCapRemaining, publish } from "../_shared/bot/publisher.ts";
import { getProvider } from "../_shared/bot/providers.ts";
import type { League } from "../_shared/bot/types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NEWS_SCORE_THRESHOLD = Number(Deno.env.get("NEWS_SCORE_THRESHOLD") || 55);

// One sentence telling the model whether this team is actually playing.
//
// Without it the bot inferred game state from the headline, and a headline
// naming two teams looks identical whether the game is on now or in March.
// That produced "Game's live right now against the Cavs — tune in" in August,
// when the Knicks' last game was two months earlier and the next is in October.
// The model cannot be trusted to know the date; it can be trusted to read a
// sentence that starts with "NO GAME".
// ---------------------------------------------------------------------------
// SOURCE: X instead of RSS.
//
// Set NEWS_SOURCE=x to switch. Everything downstream is untouched — seen_news
// dedupe, the daily cap, the persona voice, the off-character guards and
// publish() all run exactly as they do for a feed item. X only replaces where
// the FACTS come from; it does not get to write in the room's voice.
//
// Why keep two models in series: Grok finds and summarises, generateMessage
// puts it in the team's persona. Letting Grok's prose go straight to the room
// would drop the persona, the game-state guard, and the "broke character"
// checks in one step, to save a cheap call.
//
// Reversible by env var on purpose. RSS is a publisher; X is publishers plus
// everyone else, and a confident wrong take reads exactly like a scoop.
const NEWS_SOURCE = (Deno.env.get("NEWS_SOURCE") || "rss").toLowerCase();

// Stable id per citation so seen_news dedupe works the same as an RSS guid.
function xEntryId(url: string): string {
  let h = 0;
  for (let i = 0; i < url.length; i++) h = (h * 31 + url.charCodeAt(i)) | 0;
  return `x:${Math.abs(h).toString(36)}`;
}

async function fetchXNews(
  teamName: string,
  lookbackHours: number,
  league: string | null,
): Promise<Array<{
  entryId: string; title: string; link: string; source: string;
  publishedAt: string | null; imageUrl: string | null; summary: string | null;
}>> {
  // Which team at the school. A Colorado football room was handed a women's
  // volleyball result because the question only ever said "the Buffaloes".
  const sport = sportFor(league);
  const scope = sportScopeLine(teamName, sport);

  const res = await searchX(
    `What has actually happened with the ${teamName} ${sport} team in the last ${lookbackHours} hours?\n\n` +
      `${scope}\n\n` +
      `Report the news itself, not the conversation about it. Rank by what ` +
      `changes the team: a trade, a signing, an injury, a suspension, a firing, ` +
      `a starter or depth-chart change, a result that matters.\n\n` +
      `Ignore polls, "should they" questions, debate prompts, power rankings, ` +
      `hot takes, anniversary and throwback posts, and minor-league ` +
      `transactions nobody outside the front office cares about.\n\n` +
      `Prefer beat writers, the team's own account and established reporters ` +
      `over anonymous accounts. If a claim comes from a single unverified ` +
      `account, say so plainly rather than stating it as fact. If nothing ` +
      `real has happened in this window, say exactly that and stop.`,
  );
  // SECOND LOOK, WIDER — the same shape the clip bot already needed.
  // The question above asks only for news that CHANGES the team, and in late
  // August most teams have none, so Grok correctly answers "nothing" and
  // returns no citations. Strict-only meant six of ten teams got silence while
  // the clip bot, which has this fallback, filled the same rooms eight times.
  // Real news wins when it exists; this runs only when it does not.
  let out = res;
  if (!out.ok || !out.citations[0]) {
    out = await searchX(
      `What are ${teamName} ${sport} fans talking about in the last ${lookbackHours * 2} hours?\n\n` +
        `${scope}\n\n` +
        `Camp and practice notes, a player performance, a lineup or depth-chart ` +
        `note, a quote from a coach or player, a preview of the next game, ` +
        `something a beat writer reported. Anything a fan would want to know.\n\n` +
        `Still ignore polls, "should they" questions, debate prompts, power ` +
        `rankings, throwback posts and minor-league transactions. Prefer beat ` +
        `writers and the team's own account. If genuinely nothing has been ` +
        `posted about this team, say so and stop.`,
    );
  }

  if (!out.ok || !out.text.trim()) return [];

  // A citation is the source post; the synthesis is the summary. One entry —
  // the daily cap and MAX_PER_RUN already decide how much of it reaches a room.
  const link = out.citations[0];
  if (!link) return [];

  const firstLine = out.text.split(/(?<=[.!?])\s+/)[0]?.trim() || out.text.trim();
  return [{
    entryId: xEntryId(link),
    title: firstLine.slice(0, 180),
    link,
    source: "X",
    publishedAt: new Date().toISOString(),
    imageUrl: null,
    summary: out.text.trim(),
  }];
}

async function gameStateFor(
  supabase: ReturnType<typeof createClient>,
  teamId: string,
): Promise<string> {
  const nowIso = new Date().toISOString();
  const { data: rows } = await supabase
    .from("games")
    .select("status, start_time, home_team_id, away_team_id")
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .order("start_time", { ascending: false })
    .limit(60);
  if (!rows || rows.length === 0) return "NO GAME. No scheduled games on record for this team.";

  const live = rows.find((g: any) => g.status === "in_progress");
  if (live) return "LIVE. A game is in progress right now.";

  const day = (s: string) => new Date(s).toISOString().slice(0, 10);
  const today = nowIso.slice(0, 10);
  const todays = rows.find((g: any) => day(g.start_time) === today);
  if (todays) {
    return todays.status === "final"
      ? `NO GAME IN PROGRESS. Today's game already finished.`
      : `NO GAME IN PROGRESS. There is a game scheduled later today.`;
  }

  const past = rows.filter((g: any) => g.start_time < nowIso);
  const future = rows.filter((g: any) => g.start_time > nowIso).reverse();
  const last = past[0] ? `Last game was ${day(past[0].start_time)}.` : "";
  const next = future[0] ? `Next game is ${day(future[0].start_time)}.` : "No next game scheduled.";
  return `NO GAME. Not playing today. ${last} ${next}`.trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // {"source":"x"} overrides NEWS_SOURCE for ONE run. Flipping the secret
  // switches every room at once with no way to look first; this lets the new
  // source be watched on a real slate before it becomes the default.
  let body: any = null;
  try { body = await req.json(); } catch { /* cron sends {} or nothing */ }
  const sourceForRun = String(body?.source || NEWS_SOURCE).toLowerCase();

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "missing supabase env" }), { status: 500 });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const TEST_MODE = (Deno.env.get("TEST_MODE") || "false").toLowerCase() === "true";
  const TEST_TEAM = (Deno.env.get("TEST_TEAM") || "").toLowerCase();
  const provider = getProvider();

  const summary = {
    source: sourceForRun,
    started_at: new Date().toISOString(),
    teams_considered: 0,
    teams_quieted: 0,
    entries_fetched: 0,
    entries_new: 0,
    entries_out_of_window: 0, // stale, future-dated, or not an article at all
    entries_survived: 0,
    posts: 0,
    teams_with_audience: 0,
    teams_eligible: 0,
    errors: [] as string[],
    debug: [] as Record<string, unknown>[],
  };

  try {
    // Pull teams that have at least one active feed.
    const { data: feeds } = await supabase
      .from("team_feeds")
      .select("team_id, feed_url, source_label, teams!inner(id, name, city, league, highlightly_display_name)")
      .eq("is_active", true);
    if (!feeds || feeds.length === 0) {
      return new Response(JSON.stringify({ ...summary, message: "no feeds" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group by team id.
    interface TeamBundle {
      teamId: string;
      teamName: string;
      league: string;
      tokens: string[];
      feeds: { url: string; label: string }[];
    }
    const byTeam = new Map<string, TeamBundle>();
    for (const row of feeds as any[]) {
      const t = row.teams;
      // ALWAYS prefer "City Nickname". highlightly_display_name holds only the
      // bare nickname for NCAA rows, and it used to win via `||` — so the LSU
      // bundle was named "Tigers", the persona read "an opinionated Tigers
      // fan", and the model answered as a DETROIT Tigers fan. Seen in
      // production 2026-08-07 in the LSU huddle. The team's identity must be
      // unambiguous before it ever reaches the model.
      const full = `${t.city ?? ""} ${t.name ?? ""}`.trim();
      const display = full || t.highlightly_display_name || String(t.name ?? "");
      // Tokens stay broad — they only gate whether a headline from this team's
      // OWN feed is on-subject, so a loose nickname match is fine here.
      const tokens = [t.name, display, t.city, t.highlightly_display_name].filter(Boolean);
      const bundle = byTeam.get(t.id) || {
        teamId: t.id,
        teamName: display,
        league: t.league,
        tokens,
        feeds: [],
      };
      bundle.feeds.push({ url: row.feed_url, label: row.source_label || "" });
      byTeam.set(t.id, bundle);
    }

    // Process N teams per invocation in PARALLEL.  Serial was hitting the
    // 150s timeout; even with TEAMS_PER_RUN=12 each team took ~50s.
    // Parallel across 6 teams = ~50s total. Order is randomized so no
    // team gets starved.
    // KILL SWITCH. NEWS_ENABLED=false stops all news generation without a
    // deploy — one secret change to turn it back on.
    if ((Deno.env.get("NEWS_ENABLED") || "true").toLowerCase() === "false") {
      return new Response(JSON.stringify({ ...summary, message: "news disabled (NEWS_ENABLED=false)" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ONLY spend on rooms with an audience.
    //
    // This polled all 195 teams while just 40 huddles have more than one
    // member, so ~80% of the headline-judge calls scored news for rooms nobody
    // is in. The judge is ~86% of the Anthropic bill (7,200 haiku calls/day),
    // which made empty teams the single largest line item in the product.
    // The member-count test was backwards. Auto-joining every signup to their
    // team's Community room gave those seeded rooms 4-53 members each, so all
    // 195 of them cleared a ">= 2 members" bar — while a room someone made
    // themselves and sits in alone did not. We paid to write news into rooms
    // nobody chose, and stayed silent in the ones people actually built.
    //
    // A room somebody created is the signal. One member is enough: they made
    // it on purpose. Seeded rooms have to earn it with real conversation.
    // Rooms people made themselves. Nothing else.
    //
    // Tempting alternative, rejected: "seeded rooms that have been active
    // lately". last_message_at counts the BOT's own posts, so news kept 56
    // seeded rooms alive on the strength of news — the gate would have been
    // citing itself. The tell was 57, 56, 31 and 30 rooms sharing one exact
    // date. People don't talk in synchronised batches; pollers do.
    const { data: liveHuddles } = await supabase
      .from("huddles")
      .select("team_id, member_count, is_official_team_huddle")
      .gte("member_count", 1)
      .or("is_official_team_huddle.is.false,is_official_team_huddle.is.null");
    const audience = new Set(
      (liveHuddles ?? []).map((h: any) => h.team_id).filter(Boolean),
    );

    const TEAMS_PER_RUN = Number(Deno.env.get("NEWS_TEAMS_PER_RUN") || 6);
    const allBundlesRaw = Array.from(byTeam.values());
    // If nothing qualifies yet (pre-launch), fall back to every team rather
    // than going silent — an empty app is worse than a small bill.
    const allBundles = audience.size > 0
      ? allBundlesRaw.filter((b) => audience.has(b.teamId))
      : allBundlesRaw;
    summary.teams_with_audience = audience.size;
    summary.teams_eligible = allBundles.length;
    const candidates = TEST_MODE && TEST_TEAM
      ? allBundles.filter((b) => b.teamName.toLowerCase().includes(TEST_TEAM))
      : shuffle(allBundles).slice(0, TEAMS_PER_RUN);

    await Promise.all(candidates.map(async (bundle) => {
      summary.teams_considered += 1;
      const dbg: Record<string, unknown> = { team: bundle.teamName, feeds: bundle.feeds.length };
      summary.debug.push(dbg);

      // Quiet window check: ask provider for upcoming/live games for this team's league.
      const quiet = await isQuietForTeam(provider, bundle);
      dbg.quiet = quiet;
      if (quiet) {
        summary.teams_quieted += 1;
        return;
      }

      // Daily cap check up front — cheap.
      const remaining = await newsCapRemaining(supabase, bundle.teamId);
      dbg.capRemaining = remaining;
      if (remaining <= 0) return;

      // Fetch the news. X or the feeds, decided by NEWS_SOURCE.
      const allEntries: ReturnType<typeof parseRss> = [];

      if (sourceForRun === "x") {
        // One search per team per run. This is the whole reason the cadence
        // matters: X search bills per call, so 48 runs a day across ten teams
        // is the line item that makes this unaffordable. At a handful of runs
        // it is rounding.
        try {
          // 24h, not 12. Football plays once a week; a 12-hour window on a
          // Wednesday sees an empty room and reports it as no news.
          const hours = Number(Deno.env.get("NEWS_X_LOOKBACK_HOURS") || 24);
          const found = await fetchXNews(bundle.teamName, hours, bundle.league);
          allEntries.push(...found);
          dbg.xFound = found.length;
        } catch (err) {
          summary.errors.push(`xsearch ${bundle.teamName}: ${(err as Error).message}`);
        }
      } else
      for (const f of bundle.feeds) {
        try {
          const res = await fetch(f.url, {
            headers: {
              // Browser-like UA — Google News RSS rejects unknown bots from
              // datacenter IPs.
              "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
              "Accept": "application/rss+xml, application/xml, text/xml, */*",
            },
          });
          if (!res.ok) {
            // Never skip silently — a feed quietly 4xx/5xxing is exactly the
            // failure mode that left the news bot dark with empty summaries.
            summary.errors.push(`feed ${f.url}: HTTP ${res.status}`);
            continue;
          }
          const xml = await res.text();
          allEntries.push(...parseRss(xml, f.label || hostname(f.url)));
        } catch (err) {
          summary.errors.push(`feed ${f.url}: ${(err as Error).message}`);
        }
      }
      summary.entries_fetched += allEntries.length;
      dbg.fetched = allEntries.length;

      // Filter out already-seen entries.
      if (allEntries.length === 0) return;
      const ids = allEntries.map((e) => e.entryId);
      const { data: seen } = await supabase
        .from("seen_news")
        .select("entry_id")
        .eq("team_id", bundle.teamId)
        .in("entry_id", ids);
      const seenIds = new Set((seen ?? []).map((r: any) => r.entry_id));
      const unseen = allEntries.filter((e) => !seenIds.has(e.entryId));

      // NEWS HAS TO BE NEW. publishedAt was only ever used to sort, never to
      // filter, and the sort is descending — so a feed item dated in the FUTURE
      // outranked every real article from today, permanently. Schedule feeds
      // stamp entries with the GAME date, which is how a Knicks room in August
      // got handed a Knicks-Mavs game page for 4 March 2027: it sorted first
      // every single run. Bound the window at both ends.
      const MAX_AGE_H = Number(Deno.env.get("NEWS_MAX_AGE_HOURS") || 72);
      const now = Date.now();
      const oldest = now - MAX_AGE_H * 3600_000;
      const newest = now + 2 * 3600_000; // clock skew / timezone sloppiness only

      // A schedule, box score or ticket page is not an article. It has no story
      // in it, and tapping through lands on a fixture with 0-0 records.
      const NOT_AN_ARTICLE =
        /\/(game|gamecast|boxscore|scoreboard|schedule|standings|tickets|odds|matchup)(\/|\?|$)/i;

      const freshAll = unseen.filter((e) => {
        if (NOT_AN_ARTICLE.test(e.link)) return false;
        if (!e.publishedAt) return true; // undated (Google News) — judged on merit
        const t = Date.parse(e.publishedAt);
        if (!Number.isFinite(t)) return true;
        return t >= oldest && t <= newest;
      });
      summary.entries_new += freshAll.length;
      summary.entries_out_of_window += unseen.length - freshAll.length;
      if (freshAll.length === 0) return;

      // Cap per-run scoring work. Daily cap is small (5), so even on a large
      // backlog we only need to consider the freshest slice. Anything older
      // we still record in seen_news below so we skip it next run.
      const SCORE_BATCH = Number(Deno.env.get("NEWS_SCORE_BATCH") || 25);
      // Rank items that actually carry FACTS ahead of bare headlines.
      // A Google News item is a title and a redirect — no body, no summary, and
      // its opaque JS redirect exposes no OG tags either, so the bot can only
      // re-tease the headline. Outlet feeds (SB Nation et al) ship a synopsis,
      // and a direct link lets us read og:description. Same daily cap, but the
      // sources that can support a real sentence fill it first.
      const hasFacts = (e: { link: string; summary: string | null }) =>
        (e.summary && e.summary.trim().length > 0) || !/news\.google\.com/i.test(e.link);
      const sorted = [...freshAll].sort((a, b) => {
        const fa = hasFacts(a) ? 1 : 0;
        const fb = hasFacts(b) ? 1 : 0;
        if (fa !== fb) return fb - fa;
        const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
        const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
        return tb - ta;
      });
      // Source 2: photo-bearing feeds (SB Nation) publish ~10 items/day, but the
      // Google News feed floods 100+ fresher-timestamped items that would push
      // every photo item past SCORE_BATCH and get it deferred (marked seen,
      // never scored). Pull image-bearing items to the front so they always
      // reach the scorer — recency still orders within each group.
      const withImg = sorted.filter((e) => e.imageUrl);
      const noImg = sorted.filter((e) => !e.imageUrl);
      const prioritized = [...withImg, ...noImg];
      const fresh = prioritized.slice(0, SCORE_BATCH);
      const deferred = prioritized.slice(SCORE_BATCH);

      // Record deferred entries up front as "seen" so we don't rescore them.
      if (deferred.length > 0) {
        await supabase.from("seen_news").upsert(
          deferred.map((e) => ({
            team_id: bundle.teamId,
            entry_id: e.entryId,
            title: e.title,
            link: e.link,
            source: e.source,
            published_at: e.publishedAt,
            category: "DROP",                       // not scored this run
            llm_score: null,
            cluster_size: 1,
            emitted: false,
          })),
          { onConflict: "team_id,entry_id", ignoreDuplicates: true },
        );
      }

      const scored = await scoreEntries(supabase, bundle.teamId, fresh, {
        team: bundle.teamName,
        tokens: bundle.tokens,
        threshold: NEWS_SCORE_THRESHOLD,
      });

      // Record EVERY fresh entry in seen_news (whether or not it survived) so we
      // don't reconsider them next poll.  Mark emitted=false unless we publish.
      await supabase.from("seen_news").upsert(
        fresh.map((e) => {
          const match = scored.find((s) => s.entryId === e.entryId);
          return {
            team_id: bundle.teamId,
            entry_id: e.entryId,
            title: e.title,
            link: e.link,
            source: e.source,
            published_at: e.publishedAt,
            category: match?.category ?? "DROP",
            llm_score: match?.llmScore ?? null,
            cluster_size: match?.clusterSize ?? 1,
            emitted: false,
          };
        }),
        { onConflict: "team_id,entry_id", ignoreDuplicates: true },
      );

      if (scored.length === 0) return;
      summary.entries_survived += scored.length;

      // Source 2 bias: among survivors, nudge photo-bearing items up so a news
      // post is far more likely to carry an action shot. The +8 is small enough
      // that a genuinely bigger story (breaking/HIGH, scored well above) still
      // wins — it only flips near-ties toward the one with a picture.
      scored.sort((a, b) =>
        (b.finalScore + (b.imageUrl ? 8 : 0)) -
        (a.finalScore + (a.imageUrl ? 8 : 0))
      );

      // Emit up to `remaining` survivors, breaking allowed +1.
      // Per-RUN cap spaces news out across the day: the poller fires every
      // 30 min, so capping each run at 1 (breaking can add 1 more) means a
      // team's 5 daily slots land hours apart instead of 4-in-a-row.
      const MAX_PER_RUN = Number(Deno.env.get("NEWS_MAX_PER_RUN") || 1);
      let postedThisRun = 0;
      let budget = remaining;
      for (const s of scored) {
        if (postedThisRun >= MAX_PER_RUN && !s.breaking) break;
        if (budget <= 0 && !s.breaking) break;
        if (budget <= 0 && s.breaking) budget = 1; // breaking can take one over the cap

        try {
          // Fetch the article's OG metadata BEFORE writing the message. This
          // used to run afterwards, purely for the photo, which meant the
          // article's own summary was never available to the model — so a feed
          // that ships only a headline produced a re-teased headline
          // ("Colorado is looking at an elite QB prospect", never naming him).
          // One request now yields both the photo and the facts.
          //
          // Google News links are opaque JS redirects that expose no OG tags,
          // so they are still skipped; for those the feed summary is all we
          // have, and entries without one are ranked last (see ordering above).
          let ogImage: string | undefined = s.imageUrl ?? undefined;
          let ogSummary: string | undefined = s.summary ?? undefined;
          if (!/news\.google\.com/i.test(s.link) && (!ogImage || !ogSummary)) {
            const og = await fetchOgMeta(s.link);
            if (!ogImage && og.image) ogImage = og.image;
            if (!ogSummary && og.description) ogSummary = og.description;
          }

          const persona = defaultPersona(bundle.teamName, bundle.league);
          const gameState = await gameStateFor(supabase, bundle.teamId);
          const voice = await generateMessage({
            mode: "news",
            team: bundle.teamName,
            persona,
            facts: {
              headline: s.title,
              source: s.source,
              category: s.category,
              link: s.link,
              breaking: s.breaking,
              // Feed synopsis so the bot tells WHAT happened, not just the teaser.
              summary: ogSummary,
              // Anchors tense: old game recaps must read as past, not live.
              published_at: s.publishedAt ?? undefined,
              now: new Date().toISOString(),
              // The only authority on whether a game is happening.
              game_state: gameState,
            },
          });

          // Guard: never publish a thin/empty headline or an output where the
          // model broke character (asked a question, mentioned facts/headline,
          // refused). Mark it seen so we don't retry, but skip the post.
          const msg = (voice.message || "").trim();
          const brokeCharacter =
            !s.title?.trim() ||
            msg.length < 8 ||
            msg.includes("?") ||
            /\b(headline|facts?|metadata|payload|context|information|provided|mind sharing|tell me more|not enough|i don['’]?t have|the story was|share what)\b/i.test(
              msg,
            );

          // Mark this entry emitted FIRST to avoid double-publish.
          const { data: marked, error: markErr } = await supabase
            .from("seen_news")
            .update({ emitted: true, emitted_at: new Date().toISOString() })
            .eq("team_id", bundle.teamId)
            .eq("entry_id", s.entryId)
            .eq("emitted", false)
            .select("id")
            .single();
          if (markErr || !marked) continue;
          if (brokeCharacter) {
            summary.errors.push(`skipped off-voice: ${msg.slice(0, 60)}`);
            continue;
          }

          // Source 2: action photo. Prefer the image embedded in the feed XML
          // (full-res, no fetch). Only scrape og:image as a fallback for DIRECT
          // article links — never for Google News, whose opaque redirect pages
          // expose nothing useful. Null → the post just stays text-only.
          const imageUrl: string | undefined = ogImage;

          const result = await publish({
            client: supabase,
            teamId: bundle.teamId,
            teamName: bundle.teamName,
            mode: "news",
            sourceRef: marked.id,
            message: voice.message,
            facts: {
              headline: s.title,
              source: s.source,
              category: s.category,
              link: s.link,
              breaking: s.breaking,
            },
            newsLink: s.link,
            imageUrl,
          });
          summary.posts += result.huddleIdsPosted.length;
          budget -= 1;
          postedThisRun += 1;
        } catch (err) {
          summary.errors.push(`emit ${s.entryId}: ${(err as Error).message}`);
        }
      }
    }));
  } catch (err) {
    summary.errors.push(`fatal: ${(err as Error).message}`);
  }

  return new Response(JSON.stringify(summary), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function hostname(url: string): string {
  try { return new URL(url).hostname; } catch { return "feed"; }
}

async function isQuietForTeam(
  provider: ReturnType<typeof getProvider>,
  bundle: { teamName: string; league: string; tokens: string[] },
): Promise<boolean> {
  if (!bundle.league) return false;
  let games;
  try {
    games = await provider.liveGames(bundle.league as League);
  } catch {
    return false;
  }
  const matchedGame = games.find((g) => {
    const home = g.home.fullName.toLowerCase();
    const away = g.away.fullName.toLowerCase();
    const homeShort = g.home.name.toLowerCase();
    const awayShort = g.away.name.toLowerCase();
    return bundle.tokens.some((tok) => {
      const t = tok.toLowerCase();
      return home.includes(t) || away.includes(t) || homeShort.includes(t) || awayShort.includes(t);
    });
  });
  if (!matchedGame) return false;
  return isNewsQuietWindow({
    nextGameStartIso: matchedGame.startTime,
    nextGameStatus: matchedGame.status,
  });
}
