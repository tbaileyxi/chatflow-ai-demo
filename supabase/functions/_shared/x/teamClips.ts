// Ask the team's own account, instead of asking a model to go looking.
//
// The clip search used to be: pay xAI to search X in natural language, take
// whatever URLs it cited, then pay X again to read each of those posts. Two
// providers, four-ish billable calls, and a hit rate of 7 clips from 93
// attempts — because "find a video of this play" is a vague question and the
// answer was never scoped to the account that actually posts the video.
//
// This is ONE request. The club's own handle, media attached, since the play.
// X's search returns the post AND its media in the same response, so there is
// no second read at all, and xAI is out of the in-game path entirely.
//
// COST IS BOUNDED BY max_results, which is what you are billed on. The API's
// floor for recent search is 10, so a search is 10 posts whatever we ask for;
// what keeps a game cheap is how OFTEN we ask, and that is capped upstream by
// XLIVE_PER_GAME.

import type { XMedia } from "./media.ts";

const API = "https://api.x.com/2/tweets/search/recent";

export interface ClipSearchResult {
  ok: boolean;
  /** Billable posts returned — for the run summary, so spend is visible. */
  postsRead: number;
  media: XMedia[];
  error?: string;
}

/**
 * Video posted by these accounts since `sinceIso`.
 *
 * Retweets and replies are excluded: a retweet is somebody else's clip and a
 * reply is usually a fan arguing under the post.
 */
export async function findTeamClips(
  handles: string[],
  sinceIso: string,
  maxResults = 10,
): Promise<ClipSearchResult> {
  const token = Deno.env.get("X_API_BEARER_TOKEN");
  if (!token) return { ok: false, postsRead: 0, media: [], error: "no token" };
  const clean = handles.map((h) => h.replace(/^@/, "").trim()).filter(Boolean);
  if (clean.length === 0) return { ok: false, postsRead: 0, media: [], error: "no handles" };

  const from = clean.map((h) => `from:${h}`).join(" OR ");
  const qs = new URLSearchParams({
    query: `(${from}) has:media -is:retweet -is:reply`,
    max_results: String(Math.max(10, Math.min(maxResults, 100))),
    start_time: sinceIso,
    "tweet.fields": "created_at,public_metrics,attachments",
    expansions: "attachments.media_keys,author_id",
    "media.fields": "type,url,preview_image_url,variants",
    "user.fields": "username",
  });

  let j: any;
  try {
    const r = await fetch(`${API}?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) {
      return {
        ok: false,
        postsRead: 0,
        media: [],
        error: `http ${r.status}: ${(await r.text()).slice(0, 200)}`,
      };
    }
    j = await r.json();
  } catch (err) {
    return { ok: false, postsRead: 0, media: [], error: String(err).slice(0, 200) };
  }

  const posts: any[] = j?.data ?? [];
  const mediaByKey = new Map<string, any>();
  for (const m of j?.includes?.media ?? []) mediaByKey.set(m.media_key, m);
  const users = new Map<string, any>();
  for (const u of j?.includes?.users ?? []) users.set(u.id, u);

  const out: XMedia[] = [];
  for (const p of posts) {
    const keys: string[] = p?.attachments?.media_keys ?? [];
    keys.forEach((key, i) => {
      const m = mediaByKey.get(key);
      if (!m) return;
      const handle = users.get(p.author_id)?.username ?? null;

      // NOT the highest bitrate. `variants` is only present on video and gif.
      //
      // Taking the best one meant a 1920x1080 master — several megabytes that
      // a phone has to pull before anything moves, on connections where a
      // 300KB photo already took twenty seconds. The clip that plays beats the
      // clip that is sharper.
      //
      // X publishes 320 / 480 / 720 / 1080 renditions. 720 is more than a chat
      // bubble can show and starts several times faster, so: the best variant
      // at or below 720, falling back to the smallest available if X only
      // offers something bigger.
      let videoUrl: string | null = null;
      const variants = (m.variants ?? []).filter(
        (v: any) => v?.content_type === "video/mp4" && v?.url,
      );
      if (variants.length > 0) {
        const heightOf = (v: any) => {
          const wh = /\/(\d+)x(\d+)\//.exec(String(v.url));
          return wh ? Number(wh[2]) : 0;
        };
        const small = variants
          .filter((v: any) => heightOf(v) > 0 && heightOf(v) <= 720)
          .sort((a: any, b: any) => heightOf(b) - heightOf(a));
        if (small.length > 0) {
          videoUrl = small[0].url;
        } else {
          variants.sort((a: any, b: any) => (a.bit_rate ?? 0) - (b.bit_rate ?? 0));
          videoUrl = variants[0].url;
        }
      }

      out.push({
        postId: String(p.id),
        authorHandle: handle,
        text: p.text ?? "",
        likes: p?.public_metrics?.like_count ?? 0,
        type: m.type === "video" ? "video" : m.type === "animated_gif" ? "animated_gif" : "photo",
        // INDEX 0 IS THE COVER. Ranking a post's attachments by anything else
        // once put the OPPOSING team's photo in a room — the caption is
        // written about the first one.
        index: i,
        imageUrl: m.preview_image_url ?? m.url ?? "",
        videoUrl,
        url: handle
          ? `https://x.com/${handle}/status/${p.id}`
          : `https://x.com/i/status/${p.id}`,
      });
    });
  }

  return { ok: true, postsRead: posts.length, media: out };
}

/**
 * The clip worth posting.
 *
 * Video over a still — a highlight is a video, and the "stupid graphic gif
 * then the real highlight two minutes later" pattern means the photo is
 * usually the placeholder. Cover attachment only, then most liked.
 */
export function pickClip(items: XMedia[]): XMedia | null {
  const covers = items.filter((m) => m.index === 0);
  const pool = covers.length > 0 ? covers : items;
  const videos = pool.filter((m) => m.type !== "photo" && m.videoUrl);
  const best = (videos.length > 0 ? videos : pool)
    .slice()
    .sort((a, b) => b.likes - a.likes);
  return best[0] ?? null;
}
