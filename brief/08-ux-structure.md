# UX Structure

**The thing that was missing under all six mockups.** No pixels. Every section
below says what it is, what it depends on, and whether it can exist today.

---

## 1. The tabs

**What ships now:**

```
Home   ·   Search   ·   Ledger   ·   Profile
```

**The question:** does Ledger earn a permanent tab? It holds picks/fades records.
Picks are a thing to do inside a room, not a reason to open the app — one of four
permanent slots is the most expensive real estate in the product.

| | Recommend |
|---|---|
| **Home** | Keep. Your rooms. |
| **Search** | Keep. The only way to find anything you're not already in. |
| **Ledger** | **Demote** — move inside Profile, or inside a room. |
| **Profile** | Keep. |
| **→ third slot** | **People.** Friends, who's on, who to invite. Currently homeless and it's the growth surface. |

**Proposed: Home · Search · People · Profile**

---

## 2. Home — every candidate section, honestly

| # | Section | What it is | Works today? |
|---|---|---|---|
| 1 | **Your huddles** | Rooms you're in, recent first | ✅ **Yes.** No dependency. |
| 2 | **Live now** | Rooms watching something right now | ⚠️ **Half.** See below. |
| 3 | **Friends now** | Who you know that's online / in a room | ✅ **Yes.** Presence + friend graph both exist. |
| 4 | **Verified huddles** | Horizontal scroll of public rooms with hosts | ❌ **No — 0 exist.** Blocked on supply, not code. |
| 5 | **Start something** | Fast spin-up | ❌ **Not built.** |

### The "Live now" answer you were pressing on

**You were right to doubt it — and there's a free half of it.**

| | Can we know it? | How |
|---|---|---|
| A room whose **own team** is playing right now | ✅ **Yes, today** | `huddles.team_id` → `games` where that team is home or away and status is live. Zero new mechanics. |
| A room watching **any other** game | ❌ **No** | Nothing tells us. This is what fast spin-up is for. |

So Home can have a live indicator **today**, covering your-team games — which is
most of the value — with no new plumbing. It cannot cover Sunday Night Football
in an Ohio State room until spin-up exists.

**Don't design one section that pretends to do both.** Ship the half that works.

### And the bot follows the same split

The question *"how do you choose who and what bot you're watching"* has the same
answer: **you don't choose.** The room has a team, the team has a game, the bot is
that team's bot. It already works this way. There is nothing to pick.

When the room is watching something else — no bot. That's the accepted trade.

---

## 3. Do huddles have teams?

**Yes. Always.** `huddles.team_id` is `NOT NULL` — it is impossible to create a
huddle without one. Drawing "Your Huddles" without a team was a mockup error, not
a design decision.

**Every room row should show its team.** It's what tells you which game it's about
and which bot lives there.

*Rooms that aren't really about a team (Family, Tailgate) still carry one in the
database. Whether we display it for those is a real question — see `05`, q4.*

---

## 4. Where verified huddles live

Not on Home — **there are zero of them, and a horizontal scroll of nothing is
worse than no scroll.**

| Where | When |
|---|---|
| **Search**, as its own group | Now. Even empty, it says the category exists. |
| **Onboarding**, after team pick | When ≥1 exists per major team. This is the fix for the cold start. |
| **Home**, horizontal scroll | Only once a user could plausibly have joined two or three |

---

## 5. Fast spin-up — where it lives

**Not a screen. Not a nav item.** It appears in three places, always as the same
sheet, and the sheet asks one question: **who?**

| Trigger | Reads as |
|---|---|
| Your team is live and you have no room for it | "Watch this with…" |
| Tapping a friend who isn't anywhere | "Bring them here" |
| The **+** in Home's header | "Who's in?" |

**It never creates an empty room.** The room is a side effect of sending an
invite — no invite, no room.

---

## 6. The chat page — the screen never designed

Top to bottom:

| Zone | Contents | Notes |
|---|---|---|
| **Header** | ← back · room name · member count · **team + live score if the team is playing** | The score line is the whole "knows what you're watching" promise. One line, always. |
| **Thread** | Messages, bot beats inline, cards inline | No tabs. Polls, props and clips are messages, not sections. |
| **Reaction rail** | Full-width tap targets | The primitive. |
| **Composer** | Text field · camera · `@coach` | Text stays — speed matters. |

**No bottom tab bar in a room.** You're in a conversation; the tabs come back when
you leave.

---

## 7. What this settles

- **Live now** exists today for your-team games only. Ship that half.
- **Bot selection isn't a user decision.** Room → team → game → bot.
- **Every room has a team** and should show it.
- **Verified huddles go in Search first**, Home much later.
- **Spin-up is a sheet, not a screen**, and it asks "who," never "what."
- **Ledger loses its tab** to People.

## 8. What's still blocked

| Blocked | On |
|---|---|
| Live indicator for non-team games | Fast spin-up |
| Verified huddles anywhere | **Supply** — creator/chapter outreach, not app work |
| Deriving "my teams" | The app never writes `user_follows` — see `00` |

---

**Next: design the chat page against this, then re-skin Home.**
Direction: the original dark gameday, plus the filled/empty friend slots lifted
from the album exploration — *empty slots read as potential, empty rooms read as
failure* — without the card and foil treatment.
