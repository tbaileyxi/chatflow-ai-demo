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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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
    started_at: new Date().toISOString(),
    teams_considered: 0,
    teams_quieted: 0,
    entries_fetched: 0,
    entries_new: 0,
    entries_survived: 0,
    posts: 0,
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
    const TEAMS_PER_RUN = Number(Deno.env.get("NEWS_TEAMS_PER_RUN") || 6);
    const allBundles = Array.from(byTeam.values());
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

      // Fetch every feed.
      const allEntries: ReturnType<typeof parseRss> = [];
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
      const freshAll = allEntries.filter((e) => !seenIds.has(e.entryId));
      summary.entries_new += freshAll.length;
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
