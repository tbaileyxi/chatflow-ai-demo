# Open Questions

**Everything in `01`–`04` is a position. Everything here is not yet decided.**
These are listed because a brief that hides its unknowns is worse than no brief.

---

## 0. ANSWERED — the cost objection to "tonight" was wrong

*Resolved 2026-09-08 by querying production. See `00-where-we-are.md`.*

> *"Now I have to log all games and add three bots for every game."*

**The logging half is already done.** `games` holds **2,230 rows across six
leagues** — NCAAF, NFL, MLB, NCAAB, NBA, NHL — months forward. Busiest day
observed: **147 games** (Sat Sep 5). Pointing a room at any of them costs
nothing new.

**Only the bot half is a real cost**, and it is one persona, not three: the
partisan voice already exists and works when the room has a side. What's missing
is what to say about a game where the room has no dog. That is question 2, and
it is much smaller than "three bots per game."

**Still genuinely unknown:** how often the *same group* watches outside its team.
`user_follows` is empty, so we cannot even measure which teams anyone cares about.

---

## 1. Watching a game that isn't your team

The Boys is an Ohio State room. Monday night, four of them are watching
Chiefs–Bills. **Today the app cannot see that game** — the room is bound to a
team, and every intelligent part of the product reads from that binding:

- The bot fans out by team: `publisher.ts` → `.eq("team_id", teamId)`
- The Coach's game context is team-scoped: `getGameSnapshot(supabase, teamId)`

**The proposal was:** give a room a "tonight" — what it's currently watching,
separate from its permanent team.

**The objection, unresolved:** that means logging every game in every league, and
a bot per side plus a neutral one. That is a large ongoing cost for a case we
haven't sized.

**What we don't know:** how often do people actually watch outside their team
*with the same group*? If it's rare, this is over-engineering. If it's most of
the season, it's the whole product. **Nobody has looked at this yet.**

---

## 2. The bot has no neutral voice

The persona is hard-coded partisan:

> `You are a fan OF "${team}", texting a room full of other ${team} fans.`

That is the entertainment, and it should stay. But it breaks the moment a room
watches a game with neither of its teams in it.

**Options, none chosen:**
- The room picks a side for the night ("we're on Buffalo") — keeps the voice, adds a decision
- Build a neutral persona — new work, and neutral is boring
- Don't support it — the room is quiet on non-team games

---

## 3. Who controls what the room is watching

If a room can be pointed at a game, **one person tapping it changes the context
for everyone.** In a 16-person room that's a real power.

First-tap-wins? Owner only? Majority? Not decided.

---

## 4. Derived team vs picked team ⚠️ *the proposal is broken*

The brief proposes removing the team picker and deriving a room's team from what
its members follow.

**Traced: the mobile app never writes `user_follows`.** The onboarding team picker
calls `join_team_huddle()` — it adds you to the official team room instead
(`TeamPicker.tsx:85`). Across the whole mobile app, `user_follows` appears only in
the generated types file. The web app writes it; the product doesn't.

So the derivation has no signal for app users. Three ways out:

| Option | Cost |
|---|---|
| **Start writing `user_follows`** at the team step, alongside the join | One line. But keeps a picker we wanted to delete. |
| **Use room membership as the signal** — the teams whose rooms you're in | Zero new writes. Already true for every user. **Probably the answer.** |
| **Keep an explicit picker** | Rejected — it's the screen that routes people into empty rooms. |

*(The mixed-room case — four OSU fans and three Michigan fans in one Family
room — sits behind whichever of these is chosen.)*

---

## 5. Is the reaction primitive right?

The whole design in `03` rests on reactions being the default input, on the
theory that people react rather than compose during a game.

**This is a theory. It has not been tested with a single user.** If it's wrong,
Home and the room both need rework.

---

## 6. Does Path C convert?

The cold-start path lands a friendless user on a live game with a bot thread. The
claim is "a page with a live feed is never dead."

**Untested.** It may just be a nicer-looking dead end.

---

## What would settle these fastest

| Question | Cheapest way to answer |
|---|---|
| 1 | Look at existing rooms — what games do members actually have on? |
| 5 | Put the reaction rail in front of ten people during one live game |
| 6 | Ship Path C, count how many send an invite within 48h |
| 2, 3, 4 | Decide only after 1 is sized — they're all downstream of it |

**Question 1 gates the other three.** Answer it before designing further.
