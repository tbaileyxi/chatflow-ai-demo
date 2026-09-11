# Punch list — decided but not done

Things we agreed on AFTER the 2026-09-10 build. Not started.

---

## 1. Kill the Teams tab — back to three

**Decided 2026-09-10.** The tab was justified on "find team rooms you aren't
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

## 2. Scoreboard drop-down timing

Raised during Phase 3, deferred until seen in action. The sponsor board drops
over the score line in `HuddleHeader`; user wants to retune the timing after
watching it on device.

---

## Still out (unchanged from 09-build-plan)

- The reel
- Trivia and game modes — shown in ＋ as "Soon", not wired
- Verified huddle payment
- In-stadium capture
