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
- [x] A1 Default headline **FRIENDS** / subtext "Your friends can walk straight in."
- [x] A2 Toggled headline **LOCKED** / "Invitation and request to join only."
- [x] A3 Same strings in `HuddleSettingsScreen.tsx:837` (duplicated today)
- [x] A4 VERIFY "strangers can't find it" against Search and /t/ pages before the line ships

## B · Tier system
- [x] B1 Community rooms return as the home front door for followed teams
- [x] B2 Either/or home rule: community hidden for a team once you own or joined a side huddle
- [x] B3 Community comes back if that side huddle goes away
- [x] B4 "Spin up your Friends Huddle" on every community room header
- [x] B5 Avatar strip above it: friends who follow that team, lit when in the room
- [x] B6 Spin-up auto-names (display name + team), rename in settings
- [x] B7 Locked replaces community too — same rule as Friends: any room you own
      or joined for that team takes the front door's place. FLAG: say if you want
      Locked to keep the community room as a public fallback and I'll split it.

## C · Onboarding
- [x] C1 Splash down to one CTA
- [x] C2 Step dots: "step 1 of 2" is inaccurate — fix the count or drop the label
- [x] C3 Remove "have a code?"
- [x] C4 Land new users inside the most-alive community huddle, never an empty home
- [x] C5 One funnel for organic and invited; dead link -> home + "that room wrapped"
- [x] C6 Invite from Home page path (not just from inside a room)
- [x] C7 Bot welcome only in rooms you create, never per joiner in a public room

## D · Notifications
- [x] D2 Split DMs from room activity — separate section or clear marker
- [x] D3 One row per person, not four
- [x] D4 Read/unread state on DMs

## E · Screenshot bugs
- [x] E1 Keyboard does not dismiss after naming or after picking a team (Start a huddle)
- [ ] E2 Temp huddle still on home — client filters expired side huddles, but pg_cron
      is not enabled so nothing closes them server-side. Check whether expires_at is
      future (wrong list) or past (filter not reached).

## F · Smaller
- [x] F1 One invite pattern everywhere: in-app friends -> copy link -> contacts
- [x] F2 First-time hint for swipe-between-rooms
- [x] F3 "Nobody you know" paired with its action
- [x] F4 One-line explainer on "until 2am"
- [ ] F5 (parked) Shared clips deep-link back into the huddle

## G · Load-bearing
- [x] G1 Backfill a community room with a day or two of content when it starts
- [ ] G2 Keep off-day content flowing (X highlights, news) — this is what makes the
      front door worth opening at 9am on a Tuesday

## Still open
- [ ] E2 The temp huddle on Home. Client hole fixed (the membership retry was
      dropping expires_at/is_game_room on ANY error, so rooms came back looking
      permanent). The specific row needs one query to settle — is its expires_at
      past or future? `spin_up_side_huddle` is server-side and not in this repo.
- [ ] F5 (parked) Shared clips deep-link back into the huddle — waiting on locked rooms
- [ ] G2 Off-day content (X highlights, news) keeping community rooms alive at
      9am Tuesday. Ops, not app code: the bot pipeline feeds these rooms.
- [ ] RUN THE MIGRATION: supabase/migrations/20260917000001_dismiss_your_own_notifications.sql
      No DB password available locally; paste it in the SQL editor.
