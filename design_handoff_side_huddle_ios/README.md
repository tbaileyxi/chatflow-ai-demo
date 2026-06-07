# Handoff: Side Huddle — iOS App (v5)

## Overview
**Side Huddle** is a second-screen companion for sports fans: a place where you watch the game *with your crew*. The product is built around **rooms** (a.k.a. "side huddles") — small, invite-only group chats attached to a team. Your friends show up live in rooms, you jump in, and an automated **team bot** keeps the room posted with scores, news, clips, and prediction-market lines so nobody has to leave the chat.

This handoff covers the full app surface: onboarding, the home/directory, the room chat, room creation, and the navigation shell.

---

## About the design files
The files in `prototype/` are a **design reference built in HTML/React (Babel-in-browser)** — a clickable prototype that demonstrates the intended **look, layout, copy, and interactions**. They are **not** production code to ship.

**Your task:** recreate these designs in the target codebase's environment. This is an **iOS app**, so the expectation is **native SwiftUI** (or UIKit if that's the house style) using the project's existing patterns, navigation, and component library. If no iOS project exists yet, start a SwiftUI app — it maps cleanly to this design (TabView shell, NavigationStack, `.sheet`, `Menu`, `List`/`ScrollView`).

To view the prototype: open `prototype/Side Huddle Prototype v5.html` in a browser. It renders an iPhone-sized frame. There is an in-prototype "Tweaks" panel (host-driven) used during design — **ignore it for implementation**; the canonical look is the **Gold** palette, which is the default.

---

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii, and interactions are intended to be implemented as specified below. Recreate pixel-closely, then adapt to real device safe areas and native controls. The status bar (`9:41`, signal/wifi/battery) in the prototype is a **mock** — use the real iOS status bar.

---

## Design language (read first)
- **Dark mode only.** Near-black cool-ink background, layered dark surfaces, one warm **gold** accent used sparingly.
- **No emoji reactions.** Deliberately removed. Chat keeps **threaded replies** but has no reaction piles, no emoji avatars.
- **Avatars are clean monograms**, not photos or emoji: people = 2-letter initials on a deterministic muted tint; teams = abbreviation on the team color.
- **Numbers are monospace** (DM Mono): scores, cents, counts, unread badges.
- **The room is the unit.** Friends are surfaced as "who's in which room." A bot byline is always **`<Team> Bot`** (e.g. "Bears Bot") — **never** "Side Huddle Bot".
- **Smart & clean, not busy.** Generous spacing, restrained accent, strong hierarchy.

---

## Design tokens

### Color (canonical "Gold" palette)
| Token | Hex / value | Use |
|---|---|---|
| `bg` | `#0B0C0F` | App background |
| `elev` | `#101218` | Raised surfaces: app bars, cards, nav, sheets |
| `surface` | `#171A21` | Inputs, bot cards, chips, incoming bubbles |
| `surface2` | `#1F222B` | Composer field, "+N" avatar, secondary fills |
| `line` | `#272B35` | Standard borders |
| `line-soft` | `#1A1D24` | Subtle dividers between rows |
| `text` | `#ECEEF2` | Primary text |
| `text2` | `#969CA8` | Secondary text |
| `text3` | `#5A616C` | Tertiary / labels / timestamps |
| `accent` | `#F7C325` | **Gold** — primary actions, active states, links |
| `accent-dim` | `rgba(247,195,37,0.14)` | Gold tinted fills (pinned bar, selected) |
| `accent-line` | `rgba(247,195,37,0.34)` | Gold borders |
| `on-accent` | `#0B0C0F` | Text/icons on gold |
| `live` | `#FF5B4D` | Live dot, "LIVE", live score state |
| `live-dim` / `live-line` | `rgba(255,91,77,0.13)` / `0.32` | Live chip fill/border |
| `pos` | `#3FBF79` | "here"/online, Yes side, positive deltas |
| `neg` | `#F0594C` | No side, destructive (Leave room) |
| `info` | `#5B8DEF` | Source tags (Kalshi/X) |

> The prototype also includes alternate accents (Amber `#F4A52C`, Court green, Night blue, Mono) behind the Tweaks panel. **Ship Gold.** If you want a theming layer, keep `bg`/surfaces fixed and swap only `accent`/`accent-dim`/`accent-line`/`on-accent`.

### Team colors
| Team | abbr | color (tile bg) | ink (accent stripe) | league |
|---|---|---|---|---|
| Chicago Bears | CHI | `#0B162A` | `#C83803` | NFL |
| Chicago Bulls | CHI | `#1A1A1E` | `#CE1141` | NBA |
| New York Knicks | NYK | `#0B2240` | `#F58426` | NBA |
| Carolina Hurricanes | CAR | `#1A1416` | `#CC0000` | NHL |
| Notre Dame | ND | `#0C2340` | `#C99700` | NCAAF |

### Typography
- **UI font:** DM Sans (400/500/600/700/800). **Numeric font:** DM Mono (400/500/600).
- iOS: bundle DM Sans + DM Mono, **or** substitute SF Pro (text) + SF Mono (numbers) if brand allows. Letter-spacing on big headings is slightly negative; uppercase labels are widely tracked.

| Role | Size / weight / tracking |
|---|---|
| Onboarding hero | 34 / 800 / −1px, line-height 1.05 |
| Screen title (Side Huddle, section titles) | 24–25 / 800 / −0.6px |
| Sheet / nav title | 16–17 / 700–800 |
| Card title, room name, bot byline | 14–14.5 / 700 |
| Body & chat message | 14.5 / 400 (own messages 500) |
| Secondary line | 11.5–12.5 / 400–600, `text2`/`text3` |
| Uppercase label ("LIVE NOW", "PINNED", "TODAY") | 11 / 700 / 0.13em, uppercase |
| Tiny tag ("SCORE", "BOT", source) | 9.5–10 / 700 / 0.07–0.09em, uppercase |
| Score numerals | DM Mono 24–30 / 600 |
| Unread badge / counts / cents | DM Mono 10.5–13 / 600 |

### Radius & spacing
- Radii: cards **14**, bubbles **16** (collapsed tail corner **5**), pills/chips **20**, buttons **10–14**, team tiles **6–12**, avatars **full circle**, score chip **10**, bottom sheet top **22**.
- Horizontal page padding **18px** (room/composer use 12–16). Card padding **13–14**. Standard gaps **8–12**. Section label bottom margin **10**.
- Phone frame in prototype is **390×844** (logical iPhone). Bottom nav reserves ~26px home-indicator inset.

### Motion
- Entrance: small translateY+fade (`rise`/`drop`, ~160–250ms ease). Bottom sheet slides up (300ms, cubic-bezier(.32,.72,0,1)). Backdrop fades (150–200ms).
- Live dots **pulse** (1.6s loop, opacity+scale).
- Room header background **transitions over 300ms** when switching rooms (team-tint change).
- Respect Reduced Motion: show end-states without the entrance animation.

---

## Screens / Views

### 1. Onboarding  (`06-onboarding.png`)
3 steps, full-screen, gold primary button at bottom.
- **Step 0 — Intro:** hero "Where your crew watches the game." + 3 feature rows (gold dot + title + subtitle): *See who's live / Rooms for the game / Bears Bot keeps up*. Button "Get started →".
- **Step 1 — Pick your teams:** "Step 1 of 2", checklist of followed teams (team tile + name + league + check circle). Multi-select. Button "Follow N teams →" (disabled until ≥1).
- **Step 2 — You're in:** overlapping friend monograms, "You're in." + reassurance copy, button "Go to Side Huddle →".
- Progress: 2-segment bar pinned top-center on steps 1–2.

### 2. Home / Directory  (`01-home-super-huddle.png`, `02-home-my-rooms.png`)
The canonical directory is the **tabbed** layout.
- **App bar:** "Side Huddle" (24/800) + sub "Your teams. Your crew. One thread." + your monogram (right).
- **Friends now rail** (horizontal scroll): one card per friend currently in a room — monogram + name + "in a room" (green dot), team tile + room name, gold "Jump in →". Tapping opens that room. Section label is red "● FRIENDS NOW" with "N live" on the right.
- **Segmented control:** `Super Huddle` | `My Rooms` (gold filled = active). Sticky under the rail.
- **Super Huddle (default tab) — READ-ONLY digest:**
  - Row of followed-team chips (team tile + abbr) + dashed "＋ Teams" → Manage.
  - "TODAY" divider, then a single combined feed of bot items from **all** followed teams, each with a **`<Team> Bot`** byline (team tile + name + tag + time) and a content card:
    - **Score card** — home/away names + DM Mono scores + live state pill + event note.
    - **Post/X card** — handle + source tag + text + optional media clip.
    - **News card** — source tag (e.g. ESPN) + headline + optional image.
    - **Prediction card** — Kalshi tag + "PREDICTION MARKET" + question + Yes/No split bar + Yes/No buttons showing cents.
  - No composer — this surface is **not** chattable.
- **My Rooms tab:**
  - "Start a crew room" CTA (gold circle +, title + "Invite-only · attached to a team") → Create Room.
  - **Grouped** rooms with labels: **"YOU HOST · N rooms you created"** and **"YOU'RE IN · N rooms you joined"** (this distinction matters — it's how a user knows ownership vs membership).
  - Room card: team tile (40) + name (+ "● LIVE" if live) + unread badge; preview line; footer divider with stacked "here now" monograms + names, gold "Open →".
- **Bottom nav:** Home / Picks / Me (line icons; active = gold + label).

### 3. Room (chat)  (`03-room-chat.png`, `04-room-options.png`)
The core screen. Top third is intentionally compact (do not stack large score/pinned/"friends here" blocks).
- **Header** — background is **tinted with the team's `ink` color** (top→fade gradient + a 2px top accent line); it transitions when you switch rooms (identity cue). Contents in one row: back chevron (gold), team tile, room name + presence subtitle ("N here · M watching", with mini watcher monograms) — tapping name/presence opens the **Who's-in sheet**; a **live score chip** ("● 21–14 ⌄", tap to expand an inline score detail card); a **⋯ options** button.
- **Options menu** (dropdown from ⋯): **Pin a message / Unpin message** (gold), **Invite people**, **Notifications**, **Leave room** (red). Dismiss on backdrop tap.
- **Pinned message bar** (when a pin exists): gold-tinted slim row — pin icon + "PINNED" + message (truncated) + "Edit".
- **Friend-jump rail:** "JUMP" + horizontal chips of live rooms (stacked monograms + room name); current room highlighted gold; others show an unread dot. Tap to switch rooms (re-tints header, reloads thread).
- **Messages** (bottom-anchored, auto-scroll to newest):
  - **Incoming bubble:** monogram (shown on last of a run) + name + time, `surface` bubble with `line` border, 14.5px. `@mentions` rendered in gold/bold.
  - **Own bubble:** gold fill, `on-accent` text, right-aligned, no avatar.
  - **Threaded replies:** indented under a message with a 2px rail; small monogram + name + text. A subtle "Reply" affordance sits under each message.
  - **System line:** centered muted text ("Ty joined the room").
  - **Bot message:** `<Team> Bot` byline + the same card types as Super Huddle (score/post/news/prediction).
  - **Typing indicator:** muted italic "Name is typing…".
- **Composer:** circular **camera** button; a prominent rounded input field (`surface2`, border turns gold when non-empty) containing the text input + an in-field **mic/voice** icon; circular **send** button (gold when text present). Enter/return sends; new messages append at the bottom.
- **Who's-in sheet** (bottom sheet): grabber, room name + "N members · M active" + gold "Invite"; members sorted Watching → Online → Away, each monogram + name + status ("● Watching the game" / "Typing…" / "Active" / "Away · 1h").

### 4. Create Crew Room  (`05-create-room.png`)
- Back + "Start a crew room".
- **Room name** field (max 40, char counter), helper "🔒 Invite-only · attached to a team".
- **Attach to a team:** explainer that the room wakes on game day and pulls scores/news/prediction prompts for the selected team; league filter pills (All / NFL / NBA / NHL / NCAAF); **4-column grid** of team tiles (abbr on team color), selected tile = gold border + check badge.
- Sticky bottom **Create room** (gold). Creating drops the user into the new room.

### 5. Picks / Me / Manage
Placeholders in this prototype (out of scope for the design pass):
- **Picks** — prediction-market positions & weekly picks (Kalshi-powered).
- **Me** — profile: followed teams, rooms, pick history.
- **Manage teams** — add/remove teams feeding Super Huddle.
Implement the shells + nav; full content TBD with product.

---

## Interactions & behavior
- **Navigation map:** Onboarding → Home. Home(Friends rail / My Rooms) → Room. Home(Super Huddle shortcut chips) → Manage. My Rooms "Start" / Create CTA → Create Room → Room. Room back → Home. Bottom nav switches Home/Picks/Me.
- **Tab switch (Home):** Super Huddle ↔ My Rooms, local state, instant.
- **Score chip:** toggles an inline expanded score card (team names + DM Mono scores + live state).
- **Options menu / Pin:** "Pin a message" sets the pinned bar; "Unpin" clears it. (In a real build, pinning should target a selected message; the prototype pins a representative string.)
- **Friend-jump:** tapping another room chip switches the active room — header re-tints, thread + pinned + presence reload for that room.
- **Prediction card:** tapping Yes/No records an optimistic pick and nudges the cents/split. **Real values must come from Kalshi/market data**, not random text.
- **Mentions:** `@name` typed/displayed is highlighted; (autocomplete existed in earlier iterations — optional).
- **Send:** appends an own-message bubble at the bottom and clears the field; list auto-scrolls.
- **Sheets/menus:** dismiss on backdrop tap; sheet is swipe-down-friendly (use native `.sheet` detents).

## State management
- **App:** `screen` (route), `currentRoom`, `palette` (ship Gold), Home `tab`.
- **Room:** `messages[]` (per room; reset on room change), `input`, `pinned` (string|empty), `showMenu`, `showWho`, `scoreExpanded`.
- **Prediction:** local `pick` + `yes`/`no` cents (replace with live market state).
- **Onboarding:** `step`, `pickedTeams[]`.
- **Data fetching (production):** live scores & game state; team news (e.g. ESPN); social/highlight clips (X); **prediction lines (Kalshi)**; room membership/presence (who's here / watching / typing) via realtime; messages via realtime + history pagination. The bot is per-team and labeled **`<Team> Bot`**.

## Assets
- **Fonts:** DM Sans + DM Mono (Google Fonts) — bundle or substitute SF Pro/SF Mono.
- **Team logos:** the design uses **abbreviation tiles on team color as placeholders**. Replace with licensed team logos in production (keep the tile/circle shape + the team-ink accent stripe).
- **Media:** clips/photos are striped placeholder boxes — wire real video/image content.
- **Icons:** simple line SVGs (camera, mic, send, bell, pin, home/picks/me) — substitute SF Symbols (`camera`, `mic`, `paperplane.fill`, `bell`, `pin`, `house`, `target`/`scope`, `person`).
- No other external image assets.

## Files (in this bundle)
```
prototype/
  Side Huddle Prototype v5.html   ← open this; phone frame + App shell + palette + Tweaks
  sh/
    sh-core.js      ← theme tokens (as CSS vars), team data, mock content, helpers (initials, person-color)
    sh-ui.jsx       ← primitives: Avatar, TeamMark, BotByline, Stack, Dot, SourceTag, Media,
                       bot cards (Score/Post/News/Prediction), chat Bubble (+ threaded replies)
    sh-screens.jsx  ← Home (tabbed: Friends rail, SuperHuddle digest, MyRooms grouped),
                       Room (header tint, jump rail, pinned bar, options menu, composer, Who sheet),
                       CreateRoom, Onboarding, BottomNav
screens/            ← high-res reference captures of each screen
```

## Implementation notes (SwiftUI)
- Shell = `TabView` (Home/Picks/Me). Home & Create & Room pushed via `NavigationStack`.
- Room chat = `ScrollViewReader` + `LazyVStack`, bottom-anchored; threaded replies as nested rows.
- Who's-in + future pickers = `.sheet` with detents; options menu = `Menu` or a custom popover.
- Team-tint header: a `LinearGradient` of the team's `ink` over the elevated bar + a 2px top rule; animate on room change.
- Monogram avatars: deterministic hue from a stable hash of the name (see `person()` in `sh-core.js`: bg `hsl(h,26%,19%)`, fg `hsl(h,48%,74%)`, border `hsl(h,24%,30%)`).
- Force dark mode. Add haptics on Join, Send, and Yes/No pick.
