# UX — Returning User

> ⚠️ **This is the PROPOSED UX, not what ships today.** Nothing on this page
> exists in the current build. Today Home is a different screen, the room opens
> to a keyboard, and there is no live-score row on a huddle. Treat every layout
> here as a proposal to argue with.

**The rule: open app → in a conversation. One tap. Under two seconds.**

A returning user never sees a schedule, an event browser, or a game picker.
Their friends' viewing *is* the discovery mechanism.

---

## Home — the only list that exists

Home is **your rooms.** Not events, not games, not teams.

```
SIDE·HUDDLE                                    [TY]

  ● ON RIGHT NOW                          2 rooms

  ┌──────────────────────────────────────────┐
  │ THE BOYS                              2m │
  │  ■ KC  21   ■ BUF  17      3rd · 4:12    │
  │  (JK)(MI)(SA)(+1)  Dev: no way that's a  │
  └──────────────────────────────────────────┘

  ┌──────────────────────────────────────────┐
  │ OSU ALUMNI                            5m │
  │  ■ OSU  24  ■ MICH  27     4th · 9:38    │
  │  (RB)(AN)(LO)(+9)        12 watching     │
  └──────────────────────────────────────────┘

  YOUR HUDDLES                                 4
  FAMILY      Mom: you coming sunday?       1h
  TAILGATE    Ty: pulled pork or brisket   Thu

  FRIENDS NOW                             3 live
  (Jake) (Mike) (Sarah) (Anna) (Lo)
```

**Rules:**
- Rooms watching something float to the top, carrying the live score.
- Quiet rooms sit below at reduced weight — same object, less ink.
- Friends Now shows everyone you know; live ones are ringed, offline ones dimmed.
- **Never more than one screen of rooms.** If you have 40 rooms, the design failed
  upstream.

---

## The four ways a returning user arrives

| # | Trigger | What they see | Taps to conversation |
|---|---|---|---|
| 1 | **Push: room is live** — *"The Boys is watching Chiefs–Bills"* | Notification | **0** → straight into the room |
| 2 | **Push: big moment** — *"6 reacted · KC TD"* | Notification | **0** → into the room at that message |
| 3 | **Cold open, game on** | Home, live rooms on top | **1** |
| 4 | **Cold open, nothing on** | Home, quiet list + the week's feed in each room | **1** |

Push is the primary path, not the fallback. **The pull-only model is the flow problem.**

---

## The room

```
‹  KC 21 · BUF 17   3rd 4:12          THE BOYS

  ⚡ LIVE  Allen sacked on 3rd & 12.

  Jake
  ┌─────────────────────┐
  │ OHHHHH he was DONE  │
  └─────────────────────┘

        ( 🔥  6 of you · same second )

  Mike
  ┌────────────────────────────────┐
  │ that's the game if they punt   │
  └────────────────────────────────┘

                              You
              ┌──────────────────────────┐
              │ nah 4th and 6, going     │
              └──────────────────────────┘

  ┌──────┬──────┬──────┬──────┐
  │  🔥  │  😂  │  😱  │  😤  │   ← the primitive
  └──────┴──────┴──────┴──────┘
  ( Message The Boys…          @coach )
```

**Rules:**
- The room does **not** open to a keyboard. Reactions are full tap-width across
  the bottom; the text field sits beside them.
- Simultaneity renders as **one object** — "6 of you · same second" — never as
  six separate reaction counts. **⚠️ Unvalidated.** This is an invention, not a
  finding. It may read as gimmicky rather than exciting, and no user has seen it.
  A plain stacked reaction count is the safe alternative. See `05`, question 5.
- Game context is the header, one line, always. Tapping it is how you change what
  the room is watching.
- `@coach` lives in the composer. Tap to type, hold to talk.
- Bot beats are inline, visually distinct, and **rare**.
- No tabs. No Gamecast / AI / Polls sections. Polls, props and clips are cards
  **inside** the conversation.

---

## Camera and clips

Reactions are the floor; **photos and video are the ceiling.**

| Action | Where | Result |
|---|---|---|
| Hold the camera button | Composer | Instant capture → posts to room, no edit screen |
| Tap a bot clip | Thread | Plays inline |
| Screenshot the score | System | (Nothing — we never intercept) |

The Snap lesson: the fewer steps between the moment and the post, the more posts.

---

## What a returning user must never see

- A list of games to choose from
- An empty room
- A "create your first huddle" state (they have one)
- A tab bar with more than three items
- Any screen whose job is only to route them somewhere else
