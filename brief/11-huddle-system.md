# Huddle system — punch list

Decisions locked 2026-09-17:
- Community is replaced by a side huddle you **own OR joined** for that team.
- Side huddles come from spin-up **or** create. Game rooms are auto-created **and**
  spun up as temp instances.
- Spin-up from a community room does not ask for a name: display name + team logo.
- Shared clips deep-linking is parked until locked-room behaviour is settled.

## Done
- [x] **D11** Notifications DELETE policy written (`supabase/migrations/20260917000001_dismiss_your_own_notifications.sql`)
      — X and Clear all were no-ops because RLS had no DELETE policy. **Needs running in SQL editor.**
- [x] Welcome bot opener rewritten (`CreateSideHuddleScreen.tsx`)

## A · Toggle + privacy copy
- [ ] A1 Default headline **FRIENDS** / subtext "Your friends can walk straight in."
- [ ] A2 Toggled headline **LOCKED** / "Invitation and request to join only."
- [ ] A3 Same strings in `HuddleSettingsScreen.tsx:837` (duplicated today)
- [ ] A4 VERIFY "strangers can't find it" against Search and /t/ pages before the line ships

## B · Tier system
- [ ] B1 Community rooms return as the home front door for followed teams
- [ ] B2 Either/or home rule: community hidden for a team once you own or joined a side huddle
- [ ] B3 Community comes back if that side huddle goes away
- [ ] B4 "Spin up your Friends Huddle" on every community room header
- [ ] B5 Avatar strip above it: friends who follow that team, lit when in the room
- [ ] B6 Spin-up auto-names (display name + team), rename in settings
- [ ] B7 Decide whether a Locked room also replaces community

## C · Onboarding
- [ ] C1 Splash down to one CTA
- [ ] C2 Step dots: "step 1 of 2" is inaccurate — fix the count or drop the label
- [ ] C3 Remove "have a code?"
- [ ] C4 Land new users inside the most-alive community huddle, never an empty home
- [ ] C5 One funnel for organic and invited; dead link -> home + "that room wrapped"
- [ ] C6 Invite from Home page path (not just from inside a room)
- [ ] C7 Bot welcome only in rooms you create, never per joiner in a public room

## D · Notifications
- [ ] D2 Split DMs from room activity — separate section or clear marker
- [ ] D3 One row per person, not four
- [ ] D4 Read/unread state on DMs

## E · Screenshot bugs
- [ ] E1 Keyboard does not dismiss after naming or after picking a team (Start a huddle)
- [ ] E2 Temp huddle still on home — client filters expired side huddles, but pg_cron
      is not enabled so nothing closes them server-side. Check whether expires_at is
      future (wrong list) or past (filter not reached).

## F · Smaller
- [ ] F1 One invite pattern everywhere: in-app friends -> copy link -> contacts
- [ ] F2 First-time hint for swipe-between-rooms
- [ ] F3 "Nobody you know" paired with its action
- [ ] F4 One-line explainer on "until 2am"
- [ ] F5 (parked) Shared clips deep-link back into the huddle

## G · Load-bearing
- [ ] G1 Backfill a community room with a day or two of content when it starts
- [ ] G2 Keep off-day content flowing (X highlights, news) — this is what makes the
      front door worth opening at 9am on a Tuesday
