

# Dynamic Share Links for Chat Messages with Rich Previews

## The Problem
When you click the share button on a chat message in a huddle, the generated link goes to `/spotlight/{message.id}`. But:
1. Chat messages are stored in `huddle_messages` table
2. Spotlight posts are stored in a separate `posts` table
3. The SpotlightPost page only looks in `posts`, so chat message links show "Post not found"
4. Social platforms (iMessage, Twitter, etc.) only see the default Side Huddle logo since meta tags require server-side rendering

## The Solution

Create a complete sharing system for chat messages:
1. New route and page for viewing shared chat messages
2. Edge function proxy for rich social previews
3. Updated share button to generate the correct URLs

---

## Implementation Steps

### Step 1: Create New Message View Page

**New file:** `src/pages/MessagePost.tsx`

A dedicated page that:
- Fetches the message from `huddle_messages` table
- Shows the message content, author, media, and huddle context
- Includes proper meta tags via React Helmet
- Provides a "Join this Huddle" call-to-action

### Step 2: Add Route

**Update:** `src/App.tsx`

```typescript
import { MessagePost } from "./pages/MessagePost";

// Add route:
<Route path="/message/:id" element={<MessagePost />} />
```

### Step 3: Update Share Button URL

**Update:** `src/components/room/ChatMessage.tsx`

Change the share URL from spotlight to message:
```typescript
// Current (broken):
const shareUrl = `${window.location.origin}/spotlight/${message.id}`;

// New (correct):
const shareUrl = `${window.location.origin}/message/${message.id}`;
```

### Step 4: Edge Function for Rich Social Previews

**New file:** `supabase/functions/og-message/index.ts`

When someone shares a link on iMessage/Twitter/Slack:

```text
┌──────────────────────────────────────────────────────────────┐
│  Someone shares: sidehuddlesports.com/message/abc123        │
└───────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
              ┌─────────────────────────────────────┐
              │   Edge Function: og-message         │
              │   Detects User-Agent                │
              └─────────────────────┬───────────────┘
                                    │
            ┌───────────────────────┴───────────────────┐
            │                                           │
            ▼                                           ▼
   ┌─────────────────┐                       ┌─────────────────────┐
   │  Social Crawler │                       │   Regular Browser   │
   │  (iMessage, X)  │                       │                     │
   └────────┬────────┘                       └──────────┬──────────┘
            │                                           │
            ▼                                           ▼
   ┌─────────────────────┐                   ┌─────────────────────┐
   │ Return HTML with    │                   │ Redirect to SPA     │
   │ dynamic OG tags:    │                   │ /message/:id        │
   │ - Author name       │                   └─────────────────────┘
   │ - Message preview   │
   │ - Media/Team logo   │
   └─────────────────────┘
```

The edge function:
- Detects social crawlers via User-Agent header
- Fetches message + author profile from database
- Returns HTML with proper `og:title`, `og:description`, `og:image` meta tags
- Regular users get redirected to the React app

### Step 5: Update Share URL to Use Edge Function

For proper social previews, the share URL will point to the edge function:
```typescript
const shareUrl = `https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/og-message?id=${message.id}`;
```

The edge function handles both crawlers (OG tags) and regular browsers (redirect to SPA).

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/pages/MessagePost.tsx` | Create | Page to display shared chat messages |
| `src/App.tsx` | Update | Add `/message/:id` route |
| `src/components/room/ChatMessage.tsx` | Update | Fix share URL |
| `supabase/functions/og-message/index.ts` | Create | Edge function for OG meta tags |
| `supabase/config.toml` | Update | Register edge function |

---

## What the Share Preview Will Look Like

When shared on iMessage/Twitter:

```text
┌─────────────────────────────────────┐
│  [Author Avatar or Team Logo]       │
│                                     │
│  @username in Georgia Bulldogs      │
│  "Kirby's defense is elite..."      │
│  sidehuddlesports.com               │
└─────────────────────────────────────┘
```

---

## OG Tag Content Strategy

| Tag | Value |
|-----|-------|
| `og:title` | "@{username} in {huddle_name}" |
| `og:description` | First 160 characters of message content |
| `og:image` | Message media_url if exists, otherwise team logo, fallback to Side Huddle logo |
| `og:url` | Canonical message URL |
| `twitter:card` | "summary_large_image" |

---

## Technical Notes

- Edge function uses `SUPABASE_SERVICE_ROLE_KEY` to fetch message data
- Crawler detection patterns: `Twitterbot`, `facebookexternalhit`, `LinkedInBot`, `Slackbot`, `Discordbot`, `WhatsApp`, `iMessage`
- Fallback to generic Side Huddle branding if message not found
- The SPA page (`MessagePost.tsx`) also includes Helmet meta tags for users who visit directly

