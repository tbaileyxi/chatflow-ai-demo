
## Diagnosis (why iMessage still shows “Text Document” + no image)
From the screenshots and live testing of the deployed endpoint:

- Your `og-message` Edge Function **does return valid OG meta tags**, including `og:image` pointing at `og-message-image`.
- However, **Supabase Edge Functions rewrite `GET` responses that try to serve `text/html` into `Content-Type: text/plain`**.  
  I confirmed this by calling your deployed function: it returns the HTML body, but the response header is still:
  - `Content-Type: text/plain`

When iMessage sees `text/plain`, it treats the URL like a downloadable text document and shows the raw HTML instead of parsing the OG tags—so:
- No preview image
- “og-message.txt”/“Text Document”
- Click-through can be inconsistent (because it’s being handled as a document, not a webpage preview)

Good news: `og-message-image` is working correctly (it returns `Content-Type: image/jpeg` and real binary bytes). The blocker is purely that iMessage never gets to parse the OG tags because the HTML is served as plain text.

## Approach (compatible with Supabase)
Because Supabase Edge Functions cannot reliably serve `text/html` for `GET`, we’ll change the architecture:

1. **Edge Function (`og-message`) will stop returning HTML entirely.**
2. Instead, it will:
   - Generate a small HTML file containing OG tags
   - Upload it to a **public Supabase Storage bucket** (Storage serves correct `text/html`)
   - Return a **302 redirect** to the public Storage URL
3. iMessage will follow the redirect and fetch a real `text/html` page from Storage, and then it can properly render:
   - Preview title: “Post from Side Huddle”
   - Preview image: the post image (via `og-message-image`)
   - Click-through: redirects to your `/message/:id` route (using the `u=` param when available)

This keeps your long Supabase link (as requested) but makes the preview work.

## Implementation steps (code + DB migration)

### 1) Create a public Storage bucket for OG pages
Add a new Supabase migration to:
- Create bucket: `og-pages` (public = true)
- Add a SELECT policy for bucket objects (public read)

Notes:
- We will **not** add client insert/update/delete policies for this bucket, so regular users cannot upload arbitrary HTML.
- Only the Edge Function (service role) will upload OG pages.

### 2) Update `supabase/functions/og-message/index.ts` to redirect to Storage HTML
Change behavior:

**Before**
- `og-message` returns HTML → Supabase rewrites to `text/plain` → iMessage breaks.

**After**
- `og-message`:
  1. Reads `id` and optional `u`
  2. Fetches the message + huddle/profile (same as today)
  3. Computes the OG meta values:
     - `title`: “Post from Side Huddle”
     - `description`: first ~160 chars of content
     - `image`: `https://<ref>.supabase.co/functions/v1/og-message-image?id=<id>` if media image exists, else default logo (or team logo)
     - `url`: `u` (if safe) else a safe fallback
  4. Generates minimal OG HTML (same structure you already have)
  5. Uploads to Storage bucket `og-pages` at a deterministic path, for example:
     - `message/<messageId>.html`
     - (Optionally include a host prefix if we want separate pages per destination origin)
  6. Returns a `302` redirect to:
     - `https://<ref>.supabase.co/storage/v1/object/public/og-pages/message/<id>.html?v=<cachebuster>`

Why redirect instead of returning the Storage URL directly?
- Keeps your current share link format unchanged (still the functions URL).
- Lets iMessage land on a proper HTML document.

### 3) Harden `supabase/functions/og-message-image/index.ts` for crawler compatibility
Improve reliability for OG scrapers by changing fallback behavior:

- Today, when missing media, it does `Response.redirect(DEFAULT_OG_IMAGE, 302)`.
- Some preview fetchers are picky about redirects for images.

Change fallback to:
- Fetch the default image bytes server-side and return a **200** with `Content-Type: image/png` (or correct type), instead of a redirect.

Also add:
- `HEAD` method handling (return only headers) for scrapers that probe with HEAD first.

### 4) Keep / adjust the share URL generation (`src/components/room/ChatMessage.tsx`)
We’ll keep your current approach (long URL acceptable), but ensure:
- The `u=` param remains set to `window.location.origin/message/<id>` so click-through works on whichever domain you shared from.
- Keep the cache-buster `v=` to mitigate iMessage caching.

No need to change the link shape unless you want it shorter later.

## Testing / verification checklist (what we will verify after implementation)

### A) Programmatic verification (fast)
1) Call:
- `GET /functions/v1/og-message?id=<id>&u=<...>&v=<...>`
Expected:
- Status `302`
- `Location` header points to `/storage/v1/object/public/og-pages/...html`

2) Fetch the redirected Storage URL:
Expected:
- `Content-Type: text/html; charset=utf-8`
- Body contains OG tags (`og:image` etc)

3) Call:
- `GET /functions/v1/og-message-image?id=<id>`
Expected:
- Status `200`
- `Content-Type: image/*`
- Binary body

### B) iMessage end-to-end test (real)
- Copy a new share link (new `v=` value)
- Paste into iMessage
Expected:
- A proper rich preview card (not “Text Document”)
- Image shown (for posts with images)
- Tapping opens the post page correctly

## Notes about “no image” posts
For posts without an image:
- We will default to SH logo (or team logo if available and desired).
- “Screenshot of the text caption” would require an OG image renderer (separate feature); we can add that later if you want.

## Files involved (what will change)
- Edit: `supabase/functions/og-message/index.ts` (switch to Storage upload + redirect)
- Edit: `supabase/functions/og-message-image/index.ts` (return 200 for fallback + HEAD support)
- Add: `supabase/migrations/<new>_og_pages_bucket.sql` (create bucket + policy)
- Possibly minor tweak: `src/components/room/ChatMessage.tsx` (only if we decide to adjust params or cache-busting)

## Expected result
- iMessage will no longer show “og-message Text Document”
- iMessage preview will show:
  - Title: “Post from Side Huddle”
  - Image: the post’s image (when available)
  - Tap-through: opens your `/message/:id` page
