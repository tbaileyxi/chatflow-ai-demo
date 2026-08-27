// Fetch the media attached to specific X posts.
//
// WHY LOOKUP AND NOT SEARCH: X bills $0.005 per post read. Searching X for
// "best Browns photos today" reads every post the search returns — 20+ reads to
// find one good picture. But the Coach's xAI x_search ALREADY returns the post
// URLs as citations, and we pay xAI for that either way. So we arrive here
// holding the exact ids we want and read only those: ~3 posts per room per day
// instead of ~20. At ten rooms that is the difference between $30/mo and $5/mo.
//
// This endpoint reads public posts only. No posting, no account access — the
// bearer token is app-only auth on purpose.

const X_TWEETS = "https://api.x.com/2/tweets";

export interface XMedia {
  postId: string;
  authorHandle: string | null;
  text: string;
  likes: number;
  type: "photo" | "video" | "animated_gif";
  /** Position within its own post, in the order the author attached it.
   *  0 is the cover — the one the caption is written about. */
  index: number;
  imageUrl: string; // always populated: the photo, or a video's still frame
  videoUrl: string | null; // direct mp4 for video/gif, else null
  url: string; // canonical x.com permalink, for attribution
}

// "https://x.com/ScottPetrak/status/2087918064654295368" -> the trailing id.
export function postIdFromUrl(url: string): string | null {
  return url.match(/(?:twitter|x)\.com\/[^/]+\/status(?:es)?\/(\d+)/i)?.[1] ?? null;
}

// Highest-bitrate mp4 among the variants. X returns several renditions plus an
// HLS playlist; RN can't play the m3u8 without a real player, mp4 it is.
function bestMp4(variants: any[] | undefined): string | null {
  const mp4s = (variants ?? []).filter(
    (v) => v?.content_type === "video/mp4" && typeof v?.url === "string",
  );
  if (mp4s.length === 0) return null;
  mp4s.sort((a, b) => (b.bit_rate ?? 0) - (a.bit_rate ?? 0));
  return mp4s[0].url;
}

export async function fetchPostMedia(postIds: string[]): Promise<XMedia[]> {
  const token = Deno.env.get("X_API_BEARER_TOKEN");
  if (!token || postIds.length === 0) return [];

  // One request covers up to 100 ids; billing is per post read either way, so
  // batching saves round trips, not money.
  const ids = [...new Set(postIds)].slice(0, 100);
  const qs = new URLSearchParams({
    ids: ids.join(","),
    expansions: "attachments.media_keys,author_id",
    "media.fields": "type,url,preview_image_url,variants,alt_text",
    "tweet.fields": "text,public_metrics",
    "user.fields": "username",
  });

  let json: any;
  try {
    const res = await fetch(`${X_TWEETS}?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      console.error(`[x-media] ${res.status} ${(await res.text()).slice(0, 200)}`);
      return [];
    }
    json = await res.json();
  } catch (err) {
    console.error("[x-media] fetch failed", err);
    return [];
  }

  const mediaByKey = new Map<string, any>();
  for (const m of json?.includes?.media ?? []) mediaByKey.set(m.media_key, m);
  const handleById = new Map<string, string>();
  for (const u of json?.includes?.users ?? []) handleById.set(u.id, u.username);

  const out: XMedia[] = [];
  for (const post of json?.data ?? []) {
    const keys = post?.attachments?.media_keys ?? [];
    for (let i = 0; i < keys.length; i++) {
      const m = mediaByKey.get(keys[i]);
      if (!m) continue;
      // A video's `url` is absent — its still frame is preview_image_url. Taking
      // whichever exists means the chat bubble always has something to render,
      // even before the app can play video.
      const image = m.url ?? m.preview_image_url ?? null;
      if (!image || !/^https:\/\//i.test(image)) continue;
      const handle = handleById.get(post.author_id) ?? null;
      out.push({
        postId: post.id,
        authorHandle: handle,
        text: post.text ?? "",
        likes: post.public_metrics?.like_count ?? 0,
        type: m.type,
        index: i,
        imageUrl: image,
        videoUrl: m.type === "photo" ? null : bestMp4(m.variants),
        url: `https://x.com/${handle ?? "i"}/status/${post.id}`,
      });
    }
  }
  return out;
}

// Best single item to show a room: the cover of the post the room would already
// have seen going around.
//
// It used to rank every candidate photo above every candidate video, then break
// ties on likes. Two things went wrong with that, and a Bucs room showed both
// on the same message.
//
// Ordering is information. X returns `attachments.media_keys` in the order the
// author attached them, and the first one is what the caption is about — the
// play, the shot they led with. Sorting the whole pile by type discards that and
// can surface any frame from any of the five posts we read. @Buccaneers posted
// a clip of their defence breaking up passes, captioned "Picks & PBUs across the
// board"; the tweet also carried stills from the same joint practice, so the old
// sort dropped the clip and picked a photo of TREVOR LAWRENCE — the opposing
// quarterback — into a Buccaneers room. Nothing here can see what is in a
// picture, so the author's own ordering is the only signal we have about which
// attachment the words refer to, and it is a good one.
//
// The photos-over-video preference was a compatibility guard from before the app
// could play clips. It shipped on 2026-08-19, so the guard now only costs us the
// better artifact: a still frame where the source had the actual highlight.
//
// So: pick the POST on engagement, then take that post's cover.
export function pickBest(items: XMedia[]): XMedia | null {
  if (items.length === 0) return null;

  const byPost = new Map<string, XMedia[]>();
  for (const i of items) {
    const list = byPost.get(i.postId);
    if (list) list.push(i);
    else byPost.set(i.postId, [i]);
  }

  // Most-liked post wins; postId as a stable tiebreak so a re-run of the same
  // slate cannot pick a different message and post a near-duplicate.
  const best = [...byPost.values()].sort(
    (a, b) => b[0].likes - a[0].likes || a[0].postId.localeCompare(b[0].postId),
  )[0];

  return [...best].sort((a, b) => a.index - b.index)[0];
}
