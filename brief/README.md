# Side Huddle — Brief & UX

Product definition and screen-by-screen flows. Written 2026-09-08.

**Read `00` first — it is the only file with facts in it. Everything else is a position.**

| File | What's in it |
|---|---|
| [00-where-we-are.md](00-where-we-are.md) | ⚠️ **Live production numbers.** 75 users, biggest room is 7 people, three key tables at zero. Read before anything else. |
| [01-brief.md](01-brief.md) | **The one-pager.** What we are, who it's for, the goal, the experience, what we offer that chats don't, the role of the bot. |
| [02-ux-new-user.md](02-ux-new-user.md) | Screen by screen, three arrival paths. Path A (invite link) is the one that matters. |
| [03-ux-returning-user.md](03-ux-returning-user.md) | **Proposed, not shipped.** Home, the room, the four ways they arrive. |
| [04-ux-verified-huddles.md](04-ux-verified-huddles.md) | Public rooms with hosts. Verification as a ladder: official status first, money second. |
| [05-open-questions.md](05-open-questions.md) | **What is not decided**, and one thing the data has now settled. |
| [06-public-square.md](06-public-square.md) | The 195 official team rooms — what they're for, and whether they should be a screen at all. |
| [07-design-prompts.md](07-design-prompts.md) | **Copy-paste prompt set** for driving design work — seed strings, ambitious specs, the subagent critic loop, AI-tell removal. Method from Anshu Chimala / Lenny's Newsletter. |
| [08-ux-structure.md](08-ux-structure.md) | ⭐ **The structure under everything.** Tabs, every Home section with a works-today flag, where spin-up lives, the chat page. Read before any more design. |

---

## The short version

> **Never watch a game alone.**
>
> The group chat for the game — your people, in a room that already knows what's on.
> Competition is ESPN, X and Snap. Not iMessage.

**Primitive:** the reaction at the moment of the play. Text stays, beside it.

**Bot:** spine, not content. Scores in-game, social feed all week, `@coach` on demand.

**Unit of growth:** not a user — a **group**. One person brings four.

---

## What these documents are not

They are not a spec, not a build plan, and not a commitment. `01`–`04` are
positions taken so they can be argued with. `05` is the honest list of what
those positions are still resting on.

Related, in the repo:
- `CLAUDE.md` — project conventions
- `MOBILE_IMPLEMENTATION.md` — what's actually built
