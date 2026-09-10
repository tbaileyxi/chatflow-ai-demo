# UX — Verified Huddles

A **verified huddle** is a public room with a host. It is the opposite of a friend
room in exactly one way: **anyone can find it.**

| | Friend huddle | Verified huddle |
|---|---|---|
| Discovery | Only if you know someone inside | Public — searchable by anyone |
| Size | No cap | No cap |
| Who talks | Everyone | Host sets the tone, members react |
| Why it's alive | Your people are in it | The **host** is in it |
| Bot | Team feed + in-game spine | Same, plus the host's own posts |

---

## The three kinds

| Kind | The draw | Content source |
|---|---|---|
| **Creator / influencer** | A person people already follow | Their public X posts mirror in automatically — they never post twice |
| **Chapter / community** | A real-world group (alumni chapter, fan club, bar) | Members + team feed |
| **Official team** | The team itself — the public square | Team feed |

---

## Verification is a ladder, not a gate

Two separate things, in order. **Do not conflate them.**

### Step 1 — Verified: official status
The room is confirmed as genuinely theirs. What they get is **identity**: the
badge, their branding, their name, public discoverability. Free or low-friction.
This is the thing a creator or a chapter actually wants first — proof the room is
the real one.

### Step 2 — Upgrade: money
Only once verified. Paid membership, subscriptions, sponsorship on the room.
*(Schema already supports this — `huddle_pricing`, `huddle_subscriptions`,
`create-huddle-membership-checkout`.)*

**Step 1 is the product. Step 2 is the business.** A room that never upgrades is
still doing its job.

---

## Does the host have to show up?

**No — and that burden was the wrong call.**

The X mirror *is* the host showing up. Their public posts land in the room with
zero extra effort, which is the entire premise of the creator path already built
(`x_handle` + `creator-mirror`). Requiring a host to also post natively would
break the one promise that makes the pitch work: **a creator will not post twice.**

So the honest version of the rule:

> **A verified room needs a live content source — the mirror, the team feed, or a
> host who posts. Not all three, and not necessarily the host.**

`verification_expires_at` still exists and is still useful, but it should lapse on
**the room going silent**, not on the host personally going quiet.

---

## How a user finds one

| # | Screen | What's on it | They do |
|---|---|---|---|
| 1 | **Home** | Search icon in the app bar | Tap |
| 2 | **Search** | Two groups, clearly separated:<br>**"Where your people are"** — friend-scoped rooms<br>**"Verified"** — public rooms with hosts | Type or browse |
| 3 | **Room preview** | Host, member count, live activity, **last 3 messages visible**, Join button | Tap Join |
| 4 | **The conversation** | In. | — |

**Step 3 is load-bearing.** Showing the last three messages before joining is what
stops the dead-room problem — you can see whether it's alive before you commit.

---

## Joining

| Room setting | What happens on Join |
|---|---|
| **Open** | In immediately |
| **Ask to join** | Request sent, host notified, user sees "Requested" and can keep browsing |
| **Paid** | Price shown up front → checkout → in |

Never a request that vanishes into a table nobody checks — the host gets a push.

---

## Inside a verified huddle — what's different

- **Host row pinned at top** — avatar, name, "hosting", and their live status.
- **Host messages visually distinct** from member messages.
- **Reactions are the main member action.** In a 500-person room, text scrolls too
  fast to read; reactions still work at any scale.
- **Slow mode available** to the host.
- Members see **who else they know** in the room, surfaced first.

---

## For the host

| What they get | Why they'd bother |
|---|---|
| Their X posts mirror in automatically | Zero extra work — the entire pitch |
| Push to the whole room | Direct line to their audience, no algorithm |
| Member count + activity | A real number they own |
| Optional paid membership | Revenue that isn't ad-share |

**A creator will not post twice.** Any design that asks them to author content
again is dead before the first outreach message.

---

## Returning user + verified huddles

For a returning user, a verified huddle behaves exactly like any other room:

- It sits in their Home list.
- It floats up when it's live.
- It's one tap into the conversation.

**There is no separate "communities" tab.** Once you've joined, it's just a room.
The distinction between friend and verified rooms matters at *discovery* time and
nowhere else.
