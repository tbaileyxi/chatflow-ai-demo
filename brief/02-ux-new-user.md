# UX — New User

**The rule: a new user must land IN a conversation, never in a lobby, a list, or
an empty room.**

There are three ways a person arrives. Path A is the one to optimize — it is the
only one where someone already wants them there.

---

## Path A — Arrived from an invite link *(the main path)*

Someone texted them `sidehuddlesports.com/i/<code>`.

| # | Screen | What's on it | They do | Lands |
|---|---|---|---|---|
| 1 | **Link preview** | "Jake invited you to **The Boys**" · 4 faces · Open in app | Tap | App Store or app |
| 2 | **Welcome** | Wordmark. *"Jake is waiting in The Boys."* One button: **Join** | Tap Join | → 3 |
| 3 | **Phone** | Number field, keypad up | Enter number | → 4 |
| 4 | **Code** | 6 digits, auto-fill from SMS | — | → 5 |
| 5 | **You** | First name + photo (photo skippable) | Type name, Continue | → 6 |
| 6 | **THE BOYS** | **The conversation.** Jake, Mike, Sarah already talking. Bot has already posted the team's last news item. | — | Done |

**Six screens. Four taps. They end inside a live conversation with people they know.**

- No team picker.
- No contacts permission — the invite already established who they know.
- Contacts is asked for later, on second or third session, in Home.

> **Nothing else in this document matters as much as this path working.**

---

## Path B — Cold download, has contacts on Side Huddle

| # | Screen | What's on it | They do | Lands |
|---|---|---|---|---|
| 1 | **Welcome** | Wordmark + one line: *"Never watch a game alone."* Button: **Get started** | Tap | → 2 |
| 2 | **Phone** | Number field | Enter | → 3 |
| 3 | **Code** | 6 digits | — | → 4 |
| 4 | **You** | First name + photo | Continue | → 5 |
| 5 | **Find your people** | *"Checked on your phone. Nothing is stored."* Button: **Find friends** | Allow | → 6 |
| 6 | **Start a huddle** ⭐ | *"6 people you know are here."* All **pre-checked**. One button: **Start a Huddle** | Tap | → 7 |
| 7 | **Your new room** | The conversation. Members added. Bot has already posted this week's news for the team those people follow. | — | Done |

**Seven screens. Five taps.** Still no team picker, no room name typed, no invite
sent as a separate errand.

**Screen 6 is the swap.** Today this position is the team picker, and it is what
routes every new user into a 200-person room where nobody is talking.

---

## Path C — Cold download, knows nobody *(the cold start)*

The honest hard case. Do **not** pretend they have friends here.

| # | Screen | What's on it | They do | Lands |
|---|---|---|---|---|
| 1–5 | Same as Path B | | | Contacts returns nothing |
| 6 | **Your team** | Search/pick one team | Pick | → 7 |
| 7 | **The live game** | Their team's next or current game. Bot's thread running, score, news. Two buttons: **Bring your people** · **Browse huddles** | — | Done |

**They land on a game with a live feed, never in an empty community room.**
A page with a live bot thread is never dead. An empty room always is.

**Bring your people** opens the share sheet with a real invite code to a room
created for them behind the scenes — so the link works when the first friend taps it.

---

## What each path is optimizing

| Path | The job |
|---|---|
| **A** | Get them to Jake's messages in under 30 seconds |
| **B** | Turn their contact list into a room before they can bounce |
| **C** | Prove the app is alive, then convert them into Path A's *sender* |

---

## Current state vs this

| | Today | Proposed |
|---|---|---|
| Step after profile | **Team picker** | People picker |
| First room | Official team huddle (200 people, silent) | Their own room, 4–6 people they know |
| Invite | Separate errand, later, from Home | Folded into creation |
| First thing seen | A member list | A conversation |

**One screen changes and the whole funnel changes.** The team picker sits at
`OnboardingScreen.tsx` between the profile step and the contacts step.
