

## Fix iMessage Previews with Cloudflare Worker

### What we're doing
Creating a tiny Cloudflare Worker that sits between iMessage and your Supabase edge function. It fetches the OG HTML from your existing `og-message` function and serves it back with the correct `Content-Type: text/html` header -- the one thing Supabase won't let us do.

### What I will code (in this project)

**1. Simplify `og-message` edge function**
- Remove the storage upload + redirect approach (it didn't help because Storage also rewrites to `text/plain`)
- Instead, just return the OG HTML directly -- the Cloudflare Worker will fix the content-type
- Add a new query param `raw=1` that the Worker will use, so the function returns plain HTML body (no redirect)

**2. Update share URL in `ChatMessage.tsx`**
- Change the copied URL from `https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/og-message?id=...` to your Cloudflare Worker URL
- Format: `https://sh-og.YOUR_SUBDOMAIN.workers.dev/message/<id>?v=<cachebuster>`
- I'll use a placeholder like `https://sh-og.sidehuddle.workers.dev` that you'll replace with your actual Worker URL after setup

**3. Provide the complete Cloudflare Worker script**
- I'll create a file `cloudflare-worker/og-proxy.js` in your project (for reference/copy-paste)
- The Worker will:
  - Receive requests like `/message/<id>?v=...`
  - Call your Supabase `og-message` edge function with `raw=1`
  - Return the HTML with `Content-Type: text/html; charset=utf-8`
  - For non-crawler user agents, redirect straight to `sidehuddlesports.com/message/<id>`

### What you will do (simple steps)

**Step 1: Create a free Cloudflare account**
1. Go to https://dash.cloudflare.com/sign-up
2. Sign up with email (no credit card needed)

**Step 2: Create the Worker**
1. In the Cloudflare dashboard, click **"Workers & Pages"** in the left sidebar
2. Click **"Create"** button
3. Click **"Create Worker"**
4. Name it `sh-og` (or whatever you like)
5. Click **"Deploy"** (deploys the hello-world starter)
6. Click **"Edit Code"**
7. Delete everything in the editor
8. Paste the script I'll provide in `cloudflare-worker/og-proxy.js`
9. Click **"Save and Deploy"**

**Step 3: Tell me your Worker URL**
- After deploying, your Worker URL will look like: `https://sh-og.<your-subdomain>.workers.dev`
- Share it with me and I'll update the share link in the code

That's it -- 3 steps, no credit card, no domain required.

### How the flow works after this

```text
User taps "Share" in chat
        |
        v
Link copied: https://sh-og.XXX.workers.dev/message/<id>?v=<ts>
        |
        v
iMessage fetches the link
        |
        v
Cloudflare Worker receives request
        |
        v
Worker calls Supabase og-message?id=<id>&raw=1
        |
        v
Gets OG HTML (title, description, image URL)
        |
        v
Returns HTML with Content-Type: text/html  <-- THIS IS THE FIX
        |
        v
iMessage parses OG tags, shows:
  - Title: "Post from Side Huddle"
  - Image: the post's image (via og-message-image proxy)
  - Tap: opens sidehuddlesports.com/message/<id>
```

### Files I will change/create

| File | Action |
|------|--------|
| `supabase/functions/og-message/index.ts` | Simplify: return HTML directly when `raw=1` param is present |
| `src/components/room/ChatMessage.tsx` | Update share URL to use Cloudflare Worker URL (placeholder) |
| `cloudflare-worker/og-proxy.js` | New: the Worker script you'll paste into Cloudflare dashboard |

### Technical details

**Cloudflare Worker script** (what you'll paste):
- ~30 lines of JavaScript
- Extracts message ID from the URL path
- Forwards to your Supabase `og-message` edge function
- Serves the response with correct `text/html` content-type
- Adds caching headers for performance
- For regular users (not crawlers), does a fast redirect to your app

**Edge function change:**
- When `raw=1` is in the query string, return the HTML body directly (status 200) instead of uploading to storage or redirecting
- This lets the Cloudflare Worker grab the raw HTML and re-serve it with correct headers
