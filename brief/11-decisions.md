# Decisions that override the renderings

**The renderings are a starting point. This file is the spec.**

Every study in the index was made *before* the conversation that followed it, and
several were argued down in that conversation. Reading a rendering and treating
it as current is how the room got called "wrong" three times in one day when it
was right.

Index of all 24 studies:
https://claude.ai/code/artifact/13512a32-1e8b-4b01-8fbb-eff6a44d6ab5

---

## The room — SETTLED, do not re-propose

| Rendering said | Decided instead | Why |
|---|---|---|
| Bot never posts in the thread; lives in a bar | **Bot posts in the thread** | A one-line bot reads as part of the conversation. A separate bar is a second surface to watch — the same two-entry-points problem that killed the Coach tab. Length was the real complaint, fixed in `voice.ts` (one sentence preferred, two max). |
| Composer is camera ◉ / placeholder / @coach | **＋ · text · record** | ＋ opens the sheet with **Ask Coach at the top**. Camera, library, voice and the face reaction live in there too. One button, not three. |
| Header pill floats and scrolls away | **Header stays put** | You swipe between rooms. A header that has scrolled away means you cannot tell which room you are in. |
| Reaction rail is the only reaction surface | **Rail *and* floating reactions** | Floating ones drift up the right edge and cost the thread nothing — a close fourth quarter produces hundreds and they would bury the conversation under its own applause. |
| Pick card as an open/closed yes-no market | **Fade props** | The yes/no card asked a room of Yankees fans whether the Yankees would win. Everyone taps YES, nobody argues. Fade produces the argument. `prediction_card` is retired and renders nothing. |

---

## Navigation — SETTLED

**Home · Games · Search · Me.**

Teams was removed 2026-09-11. It listed your own rooms grouped by team, which
Home already does; the one distinct thing it had — other people's rooms for your
team — was the community rooms, and those were cut. Your teams are chips on
Profile with an ＋ Add, which is also the only place they have ever been
editable after day one.

Four Tabs proposed Home · Games · People · You. People did not survive; Search
did.

---

## Palette and type — SETTLED

Gold `#F5C518` on `#0A0A0B`. **Outfit** display, **Manrope** interface,
**DM Mono** data. Taken from the 10 Sept studies, which are marked
"shipped palette".

The 8–9 Sept studies use `#0D131C` with a red `#FF3D5A` accent and Big
Shoulders. **That direction is dead.** Their layouts are still the most recent
thinking for the screens they cover — Home especially — but nothing about their
skin applies.

Mono is for readings, sans is for names. Scores, clocks, counts and state go in
DM Mono; team names, people's names and prose do not.

---

## Media — SETTLED

- Nothing expires. A huddle becomes a memory of the event rather than
  evaporating. Removal is by hand, and all three routes exist.
- Dual cam is real: both cameras, back as the frame, your face in the corner.
- **Tap for a photo, hold to record**, latching after 1.2s so you can let go and
  reframe.
- Sharing is one button and the OS sheet. Watermark is **SIDE HUDDLE +
  sidehuddlesports.com**, never the room name — nearly every room is private and
  named for the people in it.

---

## How to use this file

Before building anything from a rendering, check here first. If the rendering
and this file disagree, **this file wins**. If neither covers it, ask rather
than assume the rendering is current.
