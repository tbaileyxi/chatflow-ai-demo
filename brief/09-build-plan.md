# Build Plan

**Written 2026-09-10. Decisions resolved 2026-09-10.**
One EAS build at the end. Nothing ships halfway.

**Done so far:** SMS sign-in (`sms-signin` branch). Every other screen is still
the old design.

---

## Decisions — settled

| | Settled |
|---|---|
| **Picks** | **Cut the tab. Keep the mechanic as in-room cards.** It's broken and it pulls people out of the room to look at a list. The card format works — it lives in the thread and in the ＋ fan, where the argument already is. |
| **Tabs** | **Home · Teams · Search · Me** — four, because Picks vacates a slot. No renaming, no new tabs, minimum review risk. |
| **Verified huddles** | **In.** Toggle stays on in profile so anyone can make one. **Payment deferred** — no checkout in this build. |
| **`user_follows`** | **Write it.** Following ≠ membership: you can follow a team you have no room in. But **you cannot create a huddle for a team you don't follow** — that's the gate. |
| **Dual cam** | **In.** Necessary, not v2. |
| **Swipe between rooms** | **In.** Replaces the JUMP rail. |
| **Animated reactions** | **In**, some form. Floating-ephemeral specifically is optional — the requirement is that a reaction *moves*. |
| **Sponsor** | The nudge line under the avatar row. No separate design. |
| **Owner transfer** | Do it, but it's the least impactful thing here. |

---

## Phase 1 — Data

*Nothing in the UI works until these exist.*

| | What | Note |
|---|---|---|
| 1.1 | **Write `user_follows`** at the team step | Multi-team is drawn everywhere and backed by nothing today |
| 1.2 | **Gate huddle creation on following** | Can't make a room for a team you don't follow |
| 1.3 | **Room → live game** resolver | `team_id` → `games`. Powers the score line on every room row |
| 1.4 | **Last message text per room** | Only `last_message_at` is carried today |
| 1.5 | **Presence readable from the room list** | `useHuddlePresence` exists but only works inside a room |
| 1.6 | **Gate the bot on membership** | ~300/day into empty rooms |
| 1.7 | **Backfill on first member** ⚠️ | **The fix for 1.6's side effect** — see below |
| 1.8 | **Owner transfer** | Replaces "leaving deletes everything" |

### 1.7 is not optional

Gating the bot means a room stays silent until someone joins — and with almost
every room empty, that's silence everywhere. So **when a room gains its first
member, copy in the team's recent feed.**

`backfillTeamContent()` already does exactly this in
`CreateSideHuddleScreen.tsx`. It needs to fire on *join*, not only on create.

That's what makes "the room comes furnished" true instead of aspirational.

---

## Phase 2 — Onboarding

| | | New? |
|---|---|---|
| 2.1 | Ripple opening, signed-out only | New |
| 2.2 | Phone + code on one screen | Restyle |
| 2.3 | Name + photo | Recopy |
| 2.4 | **Teams, multi-select, writes `user_follows`** | Rewrite |
| 2.5 | People — no huddle created | Remove the room creation |
| 2.6 | **Cold start** | New |
| 2.7 | **Invited path — join before name** | New routing · **highest value item in this plan** |

---

## Phase 3 — The room

*Do this before Home. The room is the product; Home is a router.*

| | |
|---|---|
| 3.1 | Floating pill — room name permanent, score secondary, ⋯ |
| 3.2 | Kill fixed header, sponsor banner, JUMP rail |
| 3.3 | **Swipe left/right between rooms** — replaces JUMP |
| 3.4 | Avatar row — visible, no overlap, See all |
| 3.5 | No bubbles — name in colour, shouts set larger |
| 3.6 | Reaction rail + **an animated reaction** |
| 3.7 | ＋ fan — library, GIF, poll, **pick**, trivia |
| 3.8 | Send button |
| 3.9 | `@coach` into the ＋ |
| 3.10 | Bot: one line in game |
| 3.11 | Pre / live / post states |
| 3.12 | Nudge line — sponsor or "another huddle is going off" |

---

## Phase 4 — Dual cam

*Its own phase because it's the largest single thing here.*

| | |
|---|---|
| 4.1 | Front + back capture in one frame, ⇄ to swap which is big |
| 4.2 | Tap = still, hold = video |
| 4.3 | Upload + storage (Supabase Storage bucket, retention policy) |
| 4.4 | Renders in thread, replayable, savable |
| 4.5 | **Cost and abuse limits** — size cap, rate limit, report path |

**4.3 and 4.5 are the real work**, not the camera. Video storage is the first
thing in this app with an unbounded cost curve.

---

## Phase 5 — Home

| | |
|---|---|
| 5.1 | Friends strip |
| 5.2 | Games strip — 6 max, hides when nothing's on |
| 5.3 | Room rows — faces, presence, game line, last message |
| 5.4 | Two live states, independent |
| 5.5 | "Game on, nobody in" nudge |
| 5.6 | ＋ Invite, not create |

---

## Phase 6 — Profile, admin, verified

*Mostly surfacing what `HuddleSettingsScreen` already does.*

| | |
|---|---|
| 6.1 | ⋯ sheet — member vs owner |
| 6.2 | Join requests, badged, with "who vouches" |
| 6.3 | Members split by presence |
| 6.4 | Profile — rooms you run, rooms you're in, multi-team chips |
| 6.5 | Public profile — mutuals, shared rooms, rooms you could join |
| 6.6 | Notifications grouped by reason |
| 6.7 | Add-people sheet — ping vs add |
| 6.8 | **Verified huddle toggle** in profile — no payment |
| 6.9 | Remove the Picks tab, re-point nav to four |

---

## Still out

- **The reel** — parked by you, and it needs Phase 4 shipped first anyway
- **Trivia and modes** — shown in the ＋ as coming, not wired
- **Verified huddle payment**
- **In-stadium capture** — same rig as 4.1, different framing

---

## Order

```
Phase 1     data + the two bug fixes
   ↓
Phase 2     onboarding
   ↓
Phase 3     the room
   ↓
Phase 4     dual cam
   ↓
Phase 5     home
   ↓
Phase 6     profile, admin, verified, tab removal
   ↓
ONE EAS build   (EAS_NO_VCS=1 — see memory)
```

---

## Scale, honestly

`HuddleScreen.tsx` is 1,673 lines and `HomeScreen.tsx` is 526; Phases 3 and 5 are
substantial rewrites of both. Phase 1 needs migrations. Phase 4 introduces media
storage the app has never had.

**Phase 4 is the long pole and the only one with an ongoing cost.** Everything
else is one-time work.
