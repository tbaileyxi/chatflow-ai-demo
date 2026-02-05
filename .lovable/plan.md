
## Current Status: Partial Fix Deployed

### What Works
- `og-message-image` edge function: ✅ Returns proper `image/jpeg` content with 200 OK
- OG HTML generation: ✅ Correct tags with proper image proxy URL
- Storage upload: ✅ HTML uploaded to `og-pages` bucket with correct mimetype in metadata

### The Blocking Issue
**Supabase explicitly blocks `text/html` content-type for security reasons (XSS prevention).**

When fetching from:
- Edge functions → Always rewritten to `text/plain`
- Storage buckets → Always rewritten to `text/plain` for HTML files

This is **by design** and cannot be changed per Supabase's official documentation and GitHub issues.

### Current Workaround
The share URL still uses the edge function, which:
1. Generates OG HTML
2. Uploads to storage
3. Redirects to storage URL
4. Storage serves the HTML content (parseable) but with `text/plain` content-type

Some crawlers (Facebook, Twitter) may still parse OG tags from `text/plain` content. iMessage is stricter.

### Alternative Solutions (Future)

1. **Deploy to Vercel/Netlify with Edge Functions**
   - These platforms can serve `text/html` properly
   - Use their edge middleware to intercept `/message/:id` routes for crawlers

2. **Use a third-party OG service**
   - Services like `opengraph.io`, `htmlcsstoimage.com`, or `cloudinary` can generate OG images
   - These can also render and proxy your OG pages

3. **Custom domain with Cloudflare Workers**
   - Deploy a Cloudflare Worker on your production domain
   - Intercept crawler requests and serve proper HTML

4. **Pre-rendering service**
   - Use `prerender.io` or similar to serve static HTML to crawlers
   - React Helmet tags will be pre-rendered

### Files Changed
- `supabase/functions/og-message/index.ts` - Uploads to storage, returns 302 redirect
- `supabase/functions/og-message-image/index.ts` - Proxy for message images (working)
- `src/components/room/ChatMessage.tsx` - Share URL uses edge function
- Created `og-pages` storage bucket with public read access

### Testing Results
- Edge function: Returns HTML correctly (as text/plain due to Supabase override)
- Image proxy: Returns binary JPEG correctly
- Storage: Correct HTML content but served as text/plain
