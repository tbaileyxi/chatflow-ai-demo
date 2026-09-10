# Where We Actually Are

**Queried live from production 2026-09-08. Read this before the brief.**

Every design position in this folder was written before these numbers. Some of
them do not survive contact with them.

---

## The product

| | Count |
|---|---|
| Users (`profiles`) | **75** |
| Huddles | 225 — of which **195 are auto-created official team rooms**, 30 are user rooms |
| Total room memberships (`huddle_members`) | **50** |
| **Largest room in the entire product** | **7 people** |
| Official rooms with 0 or 1 member | **192 of 195** |
| Verified huddles | **0** |
| Private huddles | 3 |

**User rooms by size:** 23 have 0–1 members · 5 have 2–3 · 2 have 4–10 · max is 7.

---

## ⚠️ Correction — three counts in an earlier draft were wrong

An earlier version of this file reported `friend_connections`, `user_follows` and
`picks` as **0 rows** and concluded the friend graph was empty. **That was wrong.**

Those queries ran with the anonymous key, and all three tables restrict SELECT to
the owning user:

```sql
-- friend_connections
USING (requester_id = auth.uid() OR addressee_id = auth.uid())
-- user_follows
USING (user_id = auth.uid())
```

With no `auth.uid()`, the API returns zero rows for any of them. **That measured
anon visibility, not row count.** Friends Now working in the app is the
disproof — and it is correct.

**What is still reliable** (tables that genuinely allow anon SELECT):

| Reliable | Not measurable this way |
|---|---|
| `huddles` + its `member_count` column | `friend_connections` |
| `games` | `user_follows` |
| `huddle_messages` | `picks` |
| `profiles` (floor only — private ones are filtered) | |

Anything below this line about room sizes, games and message volume stands.
Anything about the friend graph has been removed.

---

## The bot is talking to an empty room

Last 4 days, 1,000 most recent messages:

| | |
|---|---|
| Distinct senders | **3** |
| Share from the system bot | **94.1%** |
| Bot messages per day | ~200–460 |
| Total messages all-time | 25,528 |

**Message types:** `live_play` 421 · `postgame` 147 · `news` 144 · `pregame` 135 ·
`fade_prop` 86 · `creator_post` 8 · untyped (human) **59**.

The content engine works. It is producing roughly **300 messages a day into rooms
with 50 total memberships.**

---

## Games are already logged — all of them

| | |
|---|---|
| Games in `games` | **2,230** |
| Leagues covered | NCAAF · NFL · MLB · NCAAB · NBA · NHL |
| Busiest day observed | **147 games** (Sat Sep 5) |
| Median day | 3 games |

**This settles the cost objection.** "We'd have to log every game" — we already
do, across six leagues, months forward. The incremental cost of pointing a room
at any game is **not** the logging. It is only the bot's voice.

---

## Confirmed bug — the mobile team picker never writes `user_follows`

Traced 2026-09-08.

Onboarding's team step renders `components/profile/TeamPicker.tsx`, and picking a
team calls exactly one thing:

```js
await supabase.rpc("join_team_huddle", { ... })   // TeamPicker.tsx:85
```

That **adds you as a member of the team's official huddle.** It does not write
`user_follows`. Grepping the whole mobile app, `user_follows` appears **only in
the generated `types.ts`** — never read, never written, anywhere in the product.

It *is* used in the web app (`src/components/MobileOnboarding.tsx`,
`src/pages/Auth.tsx`, `YourFeed`, `TeamFeed`) — the older web flow writes it. So
the table likely has rows from web users and none from app users.

**Two consequences:**

1. Any design that derives a room's team from members' follows cannot work for
   app users. *(This is why `05` question 4 is blocked.)*
2. **This is why new users end up in official team rooms.** The picker doesn't
   express a preference — it literally joins you to the empty room.

---

## What this changes

1. **There is no scale problem.** Room size limits, big-room moderation — none of
   it is a live question. The biggest room has 7 people.
2. **The public square is 195 empty rooms.** Not a crowded stranger room — an
   auto-generated room per team, 192 of them with nobody in them.
3. **The bot posts into rooms nobody is in.** `publish()` fans out to every huddle
   with the team id, including all 195 official rooms. It should be gated on the
   room having members.
4. **Onboarding routes people into the emptiest room in the product**, by design,
   at `TeamPicker.tsx:85`.

---

## The honest read

The gamecast is **already inside the huddles.** Games sync, the bot posts, news
and clips land. It is not working because **there is nobody in the rooms.**

So the strategic question — *bring the gamecast into huddles, or bring fans into
huddles?* — has an answer from the data: **the gamecast is in. The fans are the
missing half.**

Which makes the ranked order:

| Priority | Why |
|---|---|
| **1. Stop onboarding routing people into empty official rooms** | `TeamPicker.tsx:85` joins every new user to the emptiest room we have. One screen. |
| **2. Gate the bot on room membership** | ~300 messages/day are being written into rooms with nobody in them. The feed should switch on when a team room has people, not before. |
| **3. Decide what expresses "my team"** | The app never writes `user_follows`. Either start writing it, or drop it and use room membership as the signal. |
| **4. Onboarding that ends in a room with people** | Path A / B in `02-ux-new-user.md` |
