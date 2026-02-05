
Goal: Fix iMessage link previews for shared chat messages so (1) the preview is not treated like a “text document”, and (2) the preview shows the actual message image when the message includes one.

What’s happening (based on current code + live response testing)
- The `og-message` edge function is returning HTML, but the actual HTTP response header is `Content-Type: text/plain` (confirmed via an edge-function call). iMessage is very sensitive to content-type and will often treat this as a “text document”, which breaks OG parsing and image rendering.
- Even when the OG tags are present, the image can still fail to render if:
  - the image URL is not reliably reachable by Apple’s preview fetcher, or
  - the stored URL contains HTML entities like `&amp;` (we have examples in DB), which can make the `og:image` URL invalid for crawlers.

High-reliability approach
1) Force correct HTML content-type (so iMessage parses OG properly)
2) Stop relying on third-party / messy URLs for OG images by proxying the image through our own edge function:
   - `og-message` returns OG HTML
   - `og-message-image` serves the actual image bytes with a proper `image/*` content-type and caching
   - `og:image` points to `og-message-image`, guaranteeing Apple can fetch it

Implementation plan (code changes)

A) Update `supabase/functions/og-message/index.ts`
1. Make headers unambiguous:
   - Build headers via `new Headers()` and set lowercase `content-type: text/html; charset=utf-8` (some gateways normalize/override differently than object literals).
   - Keep `X-Content-Type-Options: nosniff`.
   - Consider temporarily using `Cache-Control: no-store` while we verify in iMessage (then restore to short caching like 300s).
2. Normalize/clean URLs coming from DB:
   - Add a small helper that converts `&amp;` back to `&` for `media_url` and any other URLs before placing into OG tags.
3. Change OG image selection strategy:
   - Instead of `og:image = message.media_url`, set:
     - `og:image = https://<project-ref>.supabase.co/functions/v1/og-message-image?id=<messageId>`
   - Keep fallback behavior:
     - If message missing or has no media, `og:image` can be team logo (also proxied) or default brand image.
4. Improve redirect reliability:
   - Keep minimal body, but add `<meta http-equiv="refresh" content="0;url=...">` in addition to the link. (JS redirects can be blocked in some preview contexts.)

B) Create a new public edge function: `supabase/functions/og-message-image/index.ts`
1. Inputs:
   - `id` (message id)
2. Behavior:
   - Look up message by id in `huddle_messages` (service role).
   - Determine best image source:
     - If `media_url` exists and looks like an image (or can be fetched as an image), use it.
     - Else fallback to team logo or `DEFAULT_OG_IMAGE`.
   - Fetch the image server-side (`fetch(imageUrl, { redirect: 'follow' })`).
   - Return the image bytes:
     - Preserve upstream `content-type` if it starts with `image/`, else infer from extension (`.jpg/.jpeg => image/jpeg`, `.png => image/png`, `.webp => image/webp`, `.gif => image/gif`).
     - Set `Cache-Control: public, max-age=86400` (or similar).
3. Why this works:
   - Apple fetches the image from a stable Supabase edge URL with correct `image/*` content-type, avoiding third-party quirks and invalid querystrings/entities.

C) Register the new function in `supabase/config.toml`
- Add:
  - `[functions.og-message-image]`
  - `verify_jwt = false`

D) Update share URL generation to reduce caching pain while testing (optional but recommended)
File: `src/components/room/ChatMessage.tsx`
- Add a stable cache-buster query param so iMessage doesn’t reuse an old preview while we iterate:
  - Example: `&v=${encodeURIComponent(message.created_at)}`
- Keep the current `u=` destination param.

Verification plan (how we’ll confirm it’s fixed)
1. Programmatic check:
   - Call `og-message?id=<id>&u=<preview>/message/<id>`
   - Confirm response headers include `content-type: text/html` (not text/plain).
2. Image endpoint check:
   - Call `og-message-image?id=<id>`
   - Confirm response `content-type` is `image/jpeg` (or png/webp as appropriate) and response body is binary.
3. End-to-end iMessage check:
   - Share a newly copied link (ideally a different message id or with the new `v=` param).
   - Confirm iMessage shows:
     - Title: “Post from Side Huddle”
     - Preview image: the message’s image (not the Side Huddle logo)
   - Tap-through should land on the preview URL `/message/:id` page.

Notes / expectations
- iMessage heavily caches link previews. Even after a fix, it may keep showing the old preview for the same exact URL. The `v=` param ensures each share produces a “fresh” preview without changing the underlying message.
- If the message image is a video or a non-image URL, we’ll continue to fall back to team logo or default brand image (unless you want us to also generate video thumbnails later).

Files to change / add
- Edit: `supabase/functions/og-message/index.ts`
- Add: `supabase/functions/og-message-image/index.ts`
- Edit: `supabase/config.toml`
- Edit (optional but recommended): `src/components/room/ChatMessage.tsx`
