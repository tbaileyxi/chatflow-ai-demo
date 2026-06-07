# Handoff: Side Huddle — Visual Rebrand & UX Restructure

## Overview

This package is the design handoff for a **visual rebrand and UX restructure** of the Side Huddle Sports mobile app (PWA + Expo). The goal: strip out the "retro arcade" aesthetic (CRT flicker, scanlines, neon glow, Orbitron font) that currently fights the brand, and replace it with a clean, premium **"Sports Command Center"** look — dark, gold-accented, people-first.

The core product is unchanged. This is about **how it looks and how the chat is structured**, not new backend features. The brand pillars (black + gold, the "SH" monogram, the Huddle concept) are kept and strengthened.

## About the Design Files

The files in this bundle are **design references created in HTML/React-in-the-browser** — interactive prototypes that show the intended look and behavior. **They are NOT production code to copy directly.**

Your task is to **recreate these designs in the existing codebase** — the real app is **React + TypeScript + Vite + Tailwind + shadcn/ui + Supabase**, with a parallel **Expo/React Native** mobile app. Use the established patterns, components, and libraries already in the repo. Map every design decision below to the real files listed in the **File Map** section.

Do not introduce the HTML prototype's inline-style approach into the real codebase. Translate it into Tailwind classes + the existing CSS variable system in `src/index.css`.

## Fidelity

**High-fidelity.** Exact colors, typography, spacing, and interactions are specified below and visible in the prototype. Recreate pixel-faithfully using Tailwind + the codebase's shadcn components. Where the prototype uses emoji as team logos, **the real app already has `team.logo_url` from Supabase — use the real logos.** Emojis in the prototype are placeholders only.

---

## The Big Picture: What Changes

| Area | Current State | Target State |
|---|---|---|
| **Aesthetic** | Retro arcade — CRT flicker, animated grid, scanlines, neon glow | Clean dark "command center" — flat black surfaces, gold accent |
| **Fonts** | Orbitron + Press Start 2P + Exo 2 + Inter (4 fonts) | DM Sans (UI) + DM Mono (scores/numbers) only |
| **Chat model** | iMessage-style alternating bubbles, 5 competing bubble components | Reddit/Snap-style single column, ONE bubble component |
| **Bot** | Separate "bot message" styling, inconsistent | Bot is a first-class chat participant in BOTH public feeds and private huddles |
| **Public team feed** | Mixed chat + content | Bot-curated content feed (react-only, no free chat) |
| **Private side huddle** | Same as public | Conversational group chat (the bot still posts here too) |
| **Reactions** | Emoji picker on long-press, shown per-message | Double-tap to react; sports set 👍 🔥 😂 👎; only show when present |
| **Bottom nav** | Home / Hosted / Ledger / Profile | Home / Teams / Picks / Me |
| **Glass header** | Blue-tinted `hsla(217 33% 17%)` | Neutral `rgba(10,10,11,0.96)` |

---

## Design Tokens

Replace the dark-theme block in `src/index.css` (`:root` / `.dark`) with these. Keep HSL format to match the existing Tailwind setup, but the **target hex values** are listed for reference.

### Colors

| Token | Hex | HSL | Usage |
|---|---|---|---|
| `--bg` (background) | `#0A0A0B` | `240 6% 4%` | App base background — pure near-black, NO blue tint |
| `--bg2` | `#111113` | `240 6% 7%` | Raised surfaces, input bars, bottom nav |
| `--bg3` (card/muted) | `#18181B` | `240 6% 10%` | Cards, message backgrounds, chips |
| `--bg4` | `#222226` | `240 5% 14%` | Inset elements, reply avatars |
| `--border` | `#2A2A2F` | `240 6% 17%` | All hairline borders |
| `--gold` (primary) | `#F5C518` | `48 91% 53%` | Brand accent — CTAs, active states, own-message accent |
| `--gold-dim` | `rgba(245,197,24,0.10)` | — | Gold tint backgrounds |
| `--gold-border` | `rgba(245,197,24,0.22)` | — | Gold-bordered elements |
| `--text` (foreground) | `#F0F0F2` | `240 8% 95%` | Primary text |
| `--text2` | `#A0A0A8` | `240 5% 65%` | Secondary text, body copy |
| `--text3` | `#505058` | `240 5% 33%` | Tertiary text, timestamps, labels |
| `--red` (live/loss) | `#E8453C` | `3 80% 57%` | LIVE indicator, losses, alerts |
| `--green` (online/win) | `#22C55E` | `142 71% 45%` | Online status, wins, Yes picks |
| `--blue` (info/markets) | `#3B82F6` | `217 91% 60%` | Kalshi/prediction markets, links |

**Critical:** Remove `--team-secondary` (neon teal) and `--team-accent` (neon orange) as ambient/decorative colors. Green/red/blue become **semantic only** (status, win/loss, markets). Gold is the one brand accent.

### Typography

- **UI font:** `DM Sans` (weights 400/500/600/700/800) — replaces Inter, Exo 2, Orbitron
- **Numeric/mono font:** `DM Mono` (weights 400/500/600) — for ALL scores, odds, leaderboard points, timers, counts
- **Delete:** Orbitron, Press Start 2P, Exo 2 from `tailwind.config.ts` `fontFamily` and any Google Fonts imports

Type scale (mobile, 390px):

| Role | Size | Weight | Font | Notes |
|---|---|---|---|---|
| Hero / score | 24–32px | 700–800 | DM Mono | Live scores |
| Section title | 18–22px | 700–800 | DM Sans | "My Huddles", page titles; letter-spacing -0.5px |
| List item / name | 15px | 600–700 | DM Sans | Team names, huddle names, user names |
| Chat message | 15px | 400 | DM Sans | line-height 1.5 |
| Meta / timestamp | 11–12px | 400–600 | DM Sans | `--text3` |
| Label / badge | 9–11px | 700 | DM Sans | UPPERCASE, letter-spacing 0.07em |

### Spacing, Radius, Shadow

- Border radius: cards `12–16px`, pills/buttons `20px` (or fully round), avatars `50%`, message group rows use a `2px` left border for own-messages (gold)
- Bottom nav safe area: `padding-bottom: 24px` (accounts for home indicator)
- Header: sticky, `rgba(10,10,11,0.96)` + `backdrop-filter: blur(12px)` + 1px bottom border `--border`
- No neon glow, no box-shadow glow, no `text-shadow`. Subtle shadows only on overlays/sheets: `0 8px 28px rgba(0,0,0,0.6)`

---

## Screens / Views

The prototype (`Side Huddle Prototype v4.html`) is the canonical reference. Below, each screen maps to real files.

### 1. Onboarding Flow (5 steps)
**New flow** — first-run experience. Maps to: `src/components/EnhancedOnboarding.tsx` / `MobileOnboarding.tsx` / `Onboarding.tsx` (consolidate to one).

- **Step 0 — Welcome:** SH logo (72px), headline "Your Sports Group Chat.", 3 feature cards (🤖 Bot keeps you posted / 🎯 Kalshi prediction markets / 👀 Watch together), gold "Let's go →" CTA.
- **Step 1 — Pick sport:** "Step 1 of 3" eyebrow, 2×2 grid of league cards (NFL 🏈 / NBA 🏀 / MLB ⚾ / NCAA 🎓), single-select, gold border when selected.
- **Step 2 — Pick teams:** scrollable team list (real logos), gold circular checkmark on select. Continue button activates once ≥1 picked. **This writes to the user's followed teams → auto-joins public team huddles** (existing logic in `HuddleList`/team-follow).
- **Step 3 — Create first huddle:** preset templates (The Boys Fantasy / War Room / Bar Squad) or "name your own". Each huddle is **tied to a team** (`parent_team_id`).
- **Step 4 — All set:** confirmation, shows first live team feed preview, "Go to Side Huddle →".

Progress dots at top (gold = complete). All steps animate in with `onboardIn` (translateY 20px → 0, opacity, 0.4–0.5s ease).

### 2. Home
Maps to: `src/pages/MobileHome.tsx` + `src/components/mobile/HuddleList.tsx`

- **Remove** `crt-effect`, `retro-grid`, `retro-scanlines` wrapper divs entirely.
- Header: SH monogram (30px) + "Side Huddle" wordmark (22px/800) + total unread count badge (red pill).
- **YOUR TEAMS** section: rows with team logo (46px rounded-12 tile in team color), name, LIVE pill if game active, latest preview line, gold unread badge. Tap → Public Feed.
- **YOUR HUDDLES** section: rows with huddle avatar (46px circle — user-uploaded group photo in real app, NO emoji team badge on the avatar), huddle name + **gold team-affiliation pill** (e.g. "BEARS"), preview line, gold unread badge. Tap → Huddle chat.
- Section headers: 11px/700 UPPERCASE `--text3` + gold "+ Follow" / "+ New" action on the right.

### 3. Public Team Feed (react-only)
Maps to: `src/pages/MobileChat.tsx` (when huddle `is_official_team_huddle`) or a dedicated feed view. Reuse the unified message component.

- Header: back chevron (gold), team logo, team name, "Bot-curated feed · react to posts", LIVE pill.
- **Score ticker row** in header ONLY when live — Bears / 21 / Q3·4:22 / 14 / Lions. DM Mono numerals. **Do not also render a score card in the feed** (avoid the current double-score bug).
- Feed = stream of **bot messages** (the bot is the sender). Card types below.
- **Big reactions** under each card (👍 🔥 😂 👎, 18px emoji, DM Mono counts). No free-text chat input — instead a "Start a Side Huddle to chat…" prompt + "+ Huddle" button at the bottom.

### 4. Private Side Huddle (conversational)
Maps to: `src/pages/MobileChat.tsx` + the unified message component (replaces `ModernChatBubble.tsx` and deletes `RetroMessageBubble`, `MessageBubble`, `RoomMessageBubble`, `ModernMessageBubble`).

- Header: back, huddle avatar, huddle name + gold team pill, **tappable** "● 5 online · 8 members →" subtitle → opens Who's In Chat sheet.
- **Presence bar** (below header): stacked watcher avatars + "Ty, Sarah watching 👀" + "See all →". Tinted gold-dim. Tappable → Who's In sheet.
- Messages flow single-column, left-aligned. Own messages get a **2px gold left border + faint gold tint** (NOT right-alignment).
- **The bot posts here too** — same gold "SH" avatar + "BOT" badge — injecting score/X/Kalshi/news cards inline between user messages.
- **System messages** centered, muted: "CoachTy joined the huddle 👀", "Ty is watching 👀".
- **Replies** shown inline, always visible (not hidden behind a click), indented under parent with a 1.5px left border. "Reply…" link always present.
- **Reactions:** hidden by default. **Double-tap a message** → picker pops up (👍 🔥 😂 👎). Existing reactions render as small chips; tap a chip to toggle.
- **@mentions:** typing `@` opens a member picker; selected mention renders gold + bold in the sent message.

### 5. Who's In Chat (bottom sheet)
**New component.** Slides up from bottom (`sheetUp`, translateY 100% → 0, cubic-bezier(0.32,0.72,0,1), 0.3s). Scrim behind (`rgba(0,0,0,0.6)`, fade in).

- Drag handle, title "Who's in the Huddle", "N online · M total" subtitle, close ✕.
- Three sections: **👀 Watching now** (pulsing red dot), **● Online** (green), **○ Away** (grey). Each row: avatar with status dot, name, status line ("👀 Watching game" / "✏️ Typing…" / "Active 2m ago" / "Last seen 1h ago").
- Data source: Supabase Realtime **presence** channel (already used for typing in `MobileChat.tsx` — extend it with a `status` field).

### 6. Profile / "Me"
Maps to: `src/pages/Profile.tsx` + `src/pages/MobileProfile.tsx`

- **Remove** `crt-effect`, `retro-grid`, `retro-scanlines`.
- Header: "Me" title (22px/800).
- Profile card: avatar (64px, gold border if founding member), display name, @handle + "Founding Member ⭐" line, stat row (Teams / Huddles / Picks counts in DM Mono gold).
- Founding member banner: gold-dim card with spot number + lifetime Hosted Huddle promo code (keep existing copy logic).
- Settings list rows: Badges & Achievements / My Pick History (Ledger) / Notifications / Settings / FAQ & Help — each a tappable row with icon + chevron.
- Keep the existing edit-profile form (display name, username, email, phone, bio, avatar upload) — restyle with the new tokens, drop the retro wrappers.

### 7. Huddle Settings / Management
Maps to: `src/pages/HuddleSettings.tsx`

- Use the new neutral GlassHeader (no blue tint).
- Sections as clean cards (`--bg2`, 1px `--border`, radius 14): Huddle Info (bio, 280 char), Hosted Status / verification, Join Requests (owner), Membership Pricing, Pick'Em Settings, Members manager.
- **Add a Danger Zone** at the bottom: "Leave Huddle" (outline) and, for owners, "Delete Huddle" (red). This is the "where you leave/manage chats" surface the team asked for.

### 8. Landing Page (web)
Maps to: `src/pages/LandingPage.tsx`. Full redesign provided as `Side Huddle Landing.html`.

- DM Sans throughout (drop Orbitron).
- Sticky nav (SH mark + wordmark + "Get Early Access").
- Hero: pill badge, "Follow Your Teams. Huddle With Your Crew.", subhead, App/Play store buttons (with "Soon" badges), email waitlist (writes to `app_waitlist` Supabase table — keep existing handler).
- **New phone mockup** showing the redesigned feed (bot X post + Kalshi card + user messages + new bottom nav) — replaces the old iMessage-bubble mockup.
- Sections: Features (2×2, the 4 pillars), How It Works (3 steps), Leagues strip, **Founding 300** block (badge, perks, CTA to carrd), bottom CTA, footer.

---

## Bot Message Card Types

The bot renders these inline in both feeds and huddles. Build as a discriminated union on a `botType` field (or map from your existing `message_type` / `embed_code` schema).

| Type | Source | Renders |
|---|---|---|
| `score` | Live game data | Team / DM Mono score / quarter·clock / score / team, + event line ("Caleb Williams 12-yd TD run 🏈"). Red-tinted card. |
| `xpost` | X API (via bot) | Handle + verified ✓ + "X" source badge, tweet text, inline video player (16:9, tap-to-play) or image. **All news from ESPN/Athletic shows as the bot surfacing the @source's X post — NOT branded as ESPN directly.** |
| `kalshi` | Kalshi markets | "🎯 PREDICTION" header, question, Yes/No odds bar (green/red), tappable Yes/No buttons → records pick, shows "You picked YES" state. Blue-tinted card. |
| `news` | The Athletic etc. via X | Source badge, headline, optional image. |

Video must play **inline** (no navigation, no new tab) — your existing Supabase `video-proxy` function path is correct; just make the inline player prominent (16:9 thumbnail + gold play button, tap to play in place, muted autoplay → unmute on tap).

---

## Interactions & Behavior

- **Double-tap message** → reaction picker (popIn 0.2s scale 0.5→1.15→1). Picker: 👍 🔥 😂 👎.
- **Tap reaction chip** → toggle that reaction (optimistic update; existing Supabase reactions logic).
- **Tap member count / presence bar** → Who's In sheet slides up.
- **Type `@`** → mention autocomplete; filters members; tap inserts `@Name `.
- **Tap team row** → public feed. **Tap huddle row** → private huddle.
- **Tap Kalshi Yes/No** → records pick, odds bar animates (flex transition 0.4s).
- **System messages** animate in (joinSlide, translateY -8px → 0, 0.4s).
- **Message entrance:** slideUp (translateY 8px → 0, 0.2s ease).
- Respect `prefers-reduced-motion`.

## State Management

Existing Supabase patterns stay. New/changed state:
- **Presence with status:** extend the existing typing-presence channel in `MobileChat.tsx` to track `{ status: 'watching'|'online'|'typing'|'offline', display_name, avatar_url }`. Drives presence bar + Who's In sheet.
- **Onboarding progress:** local step state; on completion, write followed teams + created huddle to Supabase.
- **Reaction picker open state:** per-message local state.
- **Mention autocomplete:** input parse state in the chat input component.
- **Who's In sheet open state:** screen-level boolean.

## File Map (what to touch in `chatflow-ai-demo`)

**Delete / deprecate:**
- `src/components/retro/RetroMessageBubble.tsx`, `RetroChatInput.tsx`, `RetroVirtualizedChat.tsx`, `RetroHighlightsSidebar.tsx`
- `src/components/MessageBubble.tsx`, `src/components/chat/MessageBubble.tsx`, `src/components/chat/ModernMessageBubble.tsx`, `src/components/room/RoomMessageBubble.tsx`
- Retro CSS in `src/index.css`: `crt-effect`, `retro-grid`, `retro-scanlines`, `neon-text`, `retro-header`, `retro-bubble`, `neon-pulse`, all `--retro-*` / `--neon-*` / `--scanline` vars

**Edit:**
- `src/index.css` — swap the `:root`/`.dark` token blocks; remove retro layer; fix `.glass-header` to neutral black
- `tailwind.config.ts` — fontFamily to DM Sans / DM Mono; remove Orbitron/Press Start 2P/Exo 2; remove neon keyframes (`neon-pulse`, `crt-flicker`, `retro-tilt`)
- `src/components/mobile/BottomNav.tsx` — nav items: Home / Teams / Picks / Me; rename "Hosted"→"Teams", add Picks tab
- `src/components/mobile/GlassHeader.tsx` — neutral styling; single back button
- `src/components/mobile/ModernChatBubble.tsx` — becomes the ONE unified message row (user + bot + system); Reddit/Snap layout; double-tap reactions; inline replies; @mention rendering; bot card types
- `src/components/mobile/HuddleList.tsx` — team pill affiliation, remove emoji avatar badge, new row styling
- `src/pages/MobileChat.tsx` — presence-with-status; Who's In sheet; public-feed vs private-huddle modes; remove floating duplicate back button
- `src/pages/Profile.tsx` / `MobileProfile.tsx` — remove retro wrappers; stat row; settings list
- `src/pages/HuddleSettings.tsx` — restyle cards; add Danger Zone (Leave/Delete)
- `src/pages/LandingPage.tsx` — full redesign per `Side Huddle Landing.html`
- Onboarding: consolidate `EnhancedOnboarding.tsx` / `MobileOnboarding.tsx` / `Onboarding.tsx` into the 5-step flow

**New:**
- `WhoIsInChatSheet.tsx` — bottom sheet (use existing shadcn `Drawer`/`Sheet`)
- Bot card components: `BotScoreCard`, `BotXPostCard`, `BotKalshiCard`, `BotNewsCard` (or one `BotMessage` with a `botType` switch)

## Assets

- **SH monogram:** `src/assets/sh-logo-updated.png` (already in repo). The prototype draws it as a CSS circle with "SH" in Georgia serif — use the real PNG.
- **Team logos:** `team.logo_url` from Supabase `teams` table — already wired. Emojis in prototypes are placeholders ONLY.
- **Fonts:** DM Sans + DM Mono from Google Fonts.
- No other new image assets required.

## Files in This Bundle

- `Side Huddle Prototype v4.html` — canonical interactive prototype: onboarding, home, public feed, private huddle, bot cards, reactions, presence, Who's In sheet, @mentions
- `Side Huddle Landing.html` — redesigned landing page
- `Side Huddle Design Audit.html` — the full audit explaining the WHY behind each change (issues found, before/after, rationale)
- `README.md` — this file

Open the HTML files in a browser to interact with them. The v4 prototype's top label explains the gestures (tap team→feed, tap huddle→chat, double-tap msg→react, tap member count→Who's In).
