# The Public Square

**195 official team rooms exist. 192 of them have 0 or 1 member.**
*(Live count, 2026-09-08 — see `00-where-we-are.md`.)*

One auto-generated room per team, created by migration, seeded with the team feed.
That is the public square as built.

---

## What it was for

Three real jobs, and they are not the same job:

| Job | Does the current design do it? |
|---|---|
| **A floor** — a brand-new user with no friends sees *something* | Yes, but the something is an empty room |
| **A destination** — a place to land from search, SEO, an invite to no room in particular | Yes |
| **A content target** — somewhere for the bot to post so the feed isn't wasted | Yes, and it is where ~300 messages/day currently go |

---

## The problem

The failure is not that it's crowded with strangers. **It's that it's empty.**

A room with 200 strangers is at least alive. A room with zero people and a bot
posting into it four times an hour is a worse first impression than showing
nothing at all — it demonstrates, on the user's first visit, that nobody is here.

And because `friend_connections` is empty, friend-scoped search falls back to
official rooms for **every** user. So the empty square isn't the fallback
experience — right now **it is the only experience.**

---

## Three options

### A. Keep it, but stop it being a destination
The square becomes a **content archive**, not a room you enter. The bot keeps
posting there — that's how a new user's first room gets furnished, by copying the
team's recent feed in on creation (`backfillTeamContent` already does this).

Nobody is ever *routed* to an official room. It becomes plumbing.

### B. Replace it with the game
A new user with no friends lands on **their team's live or next game** —
scoreboard, bot thread, news — not a room. A game page with a live feed is never
dead. *(This is Path C in `02-ux-new-user.md`.)*

### C. Make it genuinely public and genuinely alive
Consolidate 195 rooms into a handful that could plausibly have people in them —
per league, or per marquee game — and accept them as stranger rooms with the
moderation that implies.

---

## Recommendation

**A + B.** The square survives as the content substrate that furnishes new rooms,
and no human is ever sent into one. B is what a friendless user sees instead.

C is the only option that makes the square a *feature*, and it needs a user base
that does not exist yet. **Revisit at ~10,000 users, not before.**

---

## The open question

Does the public square have a **use**, or only a **need**?

- **Use:** a place for people to go. → Currently false; nobody goes there.
- **Need:** a place for content to live so rooms can be seeded from it. → True,
  and it does this job well.

If it is only the second, it should stop being a screen and become a table.
