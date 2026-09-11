# Punch list — decided but not done

Things we agreed on AFTER the 2026-09-10 build. Not started.

---

## 1. POSSIBLY kill the Teams tab — back to three

**Leaning that way as of 2026-09-10, not decided — see how it feels on device first.** The tab was justified on "find team rooms you aren't
in." That job isn't wanted: a Browns room full of strangers is the empty-room
problem, not a fix for it. The one case worth finding — a verified or
creator-run room — is already in Search, which includes official and paid
rooms regardless of who you know.

What's left of the tab is "edit which teams you follow", and that's a Profile
row.

**Do:**
- Remove `Teams` from `TabNavigator` + `TabParamList` (back to Home · Search · Me)
- Put the team list + `TeamPicker` on `ProfileScreen`
- Keep `useFollowedTeams`, `follows.ts`, `huddles_for_teams()` — the follow
  data still drives the games strip and which team's voice the bot uses.
  Only the tab goes.

`TeamsScreen.tsx` can be deleted or kept as the Profile section's body.

---

## 2. "Start a room" is a form, and it shouldn't be

**Raised 2026-09-10 on device.** Naming a room and picking a team from a grid
of 300 is a setup wizard standing between you and the thing you came for. The
whole premise was that inviting someone is what creates the room — the room is
a side effect of "get in and go", not a form you fill out first.

Also wrong on that screen, seen on device:

- The helper line says **"Private — only people you invite can join"** while the
  Private toggle directly below it is **OFF**. One of them is lying.
- Two teams both render as **"Bears"** (Baylor and Chicago) with nothing to tell
  them apart. Same for any shared nickname. See [[live-game-vocabulary-traps]].
- The share-invite prompt fires **immediately on create**, before there is
  anything in the room to invite somebody to.

Direction, not yet designed: create should be one tap from Home with a sensible
default name and the team inferred from what you follow, with rename and team
change living in room settings where they belong.

---

## 3. Onboarding slides 1, 2 and 5 are the old deck

The ripple opener is new, then it hands straight back to five marketing slides
with a raster SH logo in a white rounded square, generic icon tiles and dot
pagination. Slides 3 (name) and 4 (teams) were rebuilt; 1, 2 and 5 were not.
This is what reads as "the design is still old".

Slide 3 also still says **"Phone number (optional) — We never text you.
Ever."** That predates SMS sign-in. You are now texted a code to get in, and
the field asks for a number you just gave.

---

## 4. Scoreboard drop-down timing

Raised during Phase 3, deferred until seen in action. The sponsor board drops
over the score line in `HuddleHeader`; user wants to retune the timing after
watching it on device.

---

## Still out (unchanged from 09-build-plan)

- The reel
- Trivia and game modes — shown in ＋ as "Soon", not wired
- Verified huddle payment
- In-stadium capture
