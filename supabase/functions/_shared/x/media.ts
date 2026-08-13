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
    for (const key of post?.attachments?.media_keys ?? []) {
      const m = mediaByKey.get(key);
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
        imageUrl: image,
        videoUrl: m.type === "photo" ? null : bestMp4(m.variants),
        url: `https://x.com/${handle ?? "i"}/status/${post.id}`,
      });
    }
  }
  return out;
}

// Best single item to show a room. Photos first: the app renders them today,
// and a still beats a video the client can only show a thumbnail of. Within a
// type, the post the room would already have seen going around — likes.
export function pickBest(items: XMedia[]): XMedia | null {
  if (items.length === 0) return null;
  const rank = (i: XMedia) => (i.type === "photo" ? 2 : 1);
  return [...items].sort(
    (a, b) => rank(b) - rank(a) || b.likes - a.likes,
  )[0];
}
