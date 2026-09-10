# Side Huddle — Design Prompt Set

Prompts only, in order. Method from Anshu Chimala's Double Diamond process
(Lenny's Newsletter). Copy-paste as-is; swap the screen name where noted.

**Screens worth running this on:** Home · The Room · Onboarding (people picker) ·
Invite/Join landing · Game surface · Verified huddle preview

---

# PHASE 1 — DISCOVER

*Goal: get many different directions on the table. Do not refine yet.*

## 1.1 Seed string (already used once — rerun for new directions)

```
I want you to build me the HOME SCREEN for Side Huddle. THIS IS FOR LOOK ONLY, NO CODE.
Follow this procedure:
1. Generate a long, random alphanumeric string using a shell script.
2. Define the creative direction (color scheme, layout, typography, etc.) based on
   the string. Look beyond the surface for subpatterns, special numbers, anything
   that inspires you.
3. Use your judgment to bring this direction to life and make it look great.
Don't reveal the string in the design. It's only for your inspiration.
```

> Rerun verbatim 4–6 times. Each run produces a different direction. Keep the two
> you'd defend to someone else.

## 1.2 Ambitious specifications

*One per run. Each is a deliberate aesthetic bet, not a tweak.*

```
Build me the Side Huddle home screen with a STADIUM SCOREBOARD theme — amber dot-matrix
LED, black field, everything on a rigid grid, numbers enormous and everything else small.
Look only, no code.
```

```
Build me the Side Huddle home screen as a BROADCAST GRAPHICS PACKAGE — lower thirds,
score bugs, wipe transitions, the visual language of a network pregame show. Look only.
```

```
Build me the Side Huddle home screen as a STICKER ALBUM / TRADING CARD collection —
each huddle is a card with a foil edge, your friends are stickers, the game is a pack
you open. Look only, no code.
```

```
Build me the Side Huddle home screen with a LOCKER ROOM material palette — athletic tape,
grease pencil on a whiteboard, mesh jersey texture, equipment-bag canvas. Physical and
tactile, not flat. Look only.
```

```
Build me the Side Huddle home screen as PRINT EPHEMERA — ticket stubs, program pages,
newsprint box scores. Heavy editorial typography, paper stock, no glow anywhere. Look only.
```

```
Build me the Side Huddle home screen with a radically ASYMMETRIC layout and dissonant
colors — deliberately uncomfortable, nothing centered, type at three wildly different
scales. Look only, no code.
```

```
Build me the Side Huddle home screen set inside an ISOMETRIC 3D STADIUM — your huddles
are sections of the stands, friends are dots in seats, the game is on the field below.
Look only, no code.
```

## 1.3 Ideation system — step 1 (go broad)

```
I want to come up with a bold, unique design language for Side Huddle — a gameday app
where you watch live sports in a group chat with people you actually know. It competes
with ESPN, X, and Snap.
Can you list as many design language ideas as you can, with short descriptions?
Go broad, not deep. At least 25.
```

## 1.4 Ideation system — step 2 (inject taste)

*Replace the bracket with your real reaction. This step is where YOUR taste enters —
do not skip it or you get the model's defaults.*

```
[Direction name]: [what you liked, what you hated, what it reminded you of, what's
too safe about it, what you'd push further].
Can you sharpen this one based on my tastes?
```

## 1.5 Ideation system — step 3 (turn it into a build prompt)

```
Can you write a concise prompt that an AI agent could use to build an initial POC of the
Side Huddle home screen with this direction?
```

---

# PHASE 2 — DEFINE

*Goal: take ONE direction and push it to studio quality.*

## 2.1 The critic loop ⭐ *the highest-leverage prompt here*

```
I want you to improve this Side Huddle design. Use a Fable subagent as a design critic.
Follow this procedure at each iteration:
1. Capture a screenshot of the current design.
2. Invoke the critic in a fresh context with the screenshot.
3. Ask it to evaluate the aesthetic and provide a score out of 10.
4. Apply its feedback.
5. Repeat until it scores 9/10 or higher.

Give the critic this guidance:
"Think high-level about structure and composition. Watch out for overdone patterns or
obviously AI-generated elements. Provide tight, specific feedback. Be bold and opinionated.
This is a live-sports group chat app competing with ESPN, X and Snap — it should look like
gameday, not like a SaaS dashboard. Score out of 10."
```

> Keep the score criterion objective and in the critic's prompt. Use a cheap model to
> implement, an expensive one to critique.

## 2.2 Critic variant — the specific failure modes

```
Same critic loop, but have the critic check these specifically:
- Does any screen show an empty room, an empty list, or a zero state presented as a destination?
- Is the conversation more than one tap from the first screen?
- Do the reactions read as the primary input, or does the keyboard dominate?
- Does the scoreline read at a glance without reading the numbers?
- Would this be mistaken for a fantasy app, a betting app, or a generic chat app?
```

## 2.3 Image generation

*Requires an OpenAI or Gemini API key.*

```
The design is pretty plain. Add more personality using image generation. Consider shaders
or 3D effects in combination with images. Subject matter should be gameday texture —
crowd blur, field turf, stadium light bloom, jersey mesh — never stock-photo athletes
and never a generic sports montage.
My API key is for local use only, not to be stored in code.
```

## 2.4 Video / motion

*Requires a fal.ai API key.*

```
Replace the static hero on this page with a looping video clip that does something more
interesting — a crowd reaction rippling outward from one point, matched to the "everyone
reacted at the same second" idea. Use my fal.ai API key.
```

```
Build a demo page showing interactive transitions between the Side Huddle home screen and
a room, using a video model to generate the transition. Use a model with strong physics
consistency. Use my fal.ai API key.
```

## 2.5 The reaction moment — the one interaction worth prototyping

```
Prototype ONE interaction at high fidelity: six people in a room hitting the same reaction
within the same second during a live play. Show what it looks like on screen. This is the
single thing iMessage cannot do, so it has to feel like something. Try at least three
completely different treatments before picking one.
```

---

# PHASE 3 — DELIVER

*Goal: remove everything that doesn't earn its place.*

## 3.1 Reductive refinement

```
Simplify the layout. Get rid of gradients, glows, and unnecessary containers. Every border,
fill, radius and shadow has to justify itself — if it doesn't separate two things that are
genuinely separate, delete it. Aim for a truly minimalist result without losing the gameday
character.
```

## 3.2 Remove the AI tells

```
Go through this design and remove anything that reads as AI-generated:
- Everything on the same corner radius and the same shadow
- An accent bar or rail on every card
- Emoji used as section markers
- Centered everything
- A purple-to-blue gradient anywhere
- Inter or Space Grotesk as the default face
- Warm cream + serif display + terracotta accent
- Near-black with a single acid-green or vermilion pop
- Big-number stat tiles for figures that aren't the point of the screen
Replace each with something a human designer would have chosen for THIS product.
```

## 3.3 Real content pass

```
Replace every placeholder with real Side Huddle content: actual team abbreviations and
colors, a real down-and-distance, real message copy that sounds like a group chat during
a game (not full sentences, not punctuated), real room names, real friend names.
Nothing that would only exist in a mockup.
```

## 3.4 Both-themes pass

```
Check this in light and dark. Every color comes from a token defined in the base :root
block. Nothing gets its only definition inside a media query or a [data-theme] block.
If the design deliberately commits to one theme, say so explicitly and make sure it still
holds on the other host background.
```

---

# PHASE 4 — SIDE HUDDLE SPECIFIC

*Not in the article. These are the prompts this product needs that a landing page wouldn't.*

## 4.1 The screen set

```
Design these six Side Huddle screens in one consistent visual language, as a set:
1. Home — your rooms, what they're watching
2. The Room — conversation, reactions primary, coach in the composer
3. Onboarding — the people picker ("6 people you know are here")
4. Invite landing — what someone sees when a friend texts them a link
5. Verified huddle preview — before you join, showing it's alive
6. The cold start — a user with no friends and no contacts loaded
Look only, no code. Screen 6 is the hardest — do not make it look easy.
```

## 4.2 The adversarial pass

```
You are a skeptical product designer seeing Side Huddle for the first time. Pick apart
this design. Where would a real user get stuck, bounce, or not understand what to do?
Be specific about which element causes it. Do not suggest fixes — only find problems.
```

## 4.3 The competitor pass

```
Put this Side Huddle screen next to a screenshot of ESPN, X, Snap, and GroupMe.
What does it look like a worse version of? Answer honestly. Then tell me what would have
to change for it to look like its own thing rather than a blend of those four.
```

## 4.4 The one-look test

```
Show this design to a fresh subagent for the equivalent of two seconds — describe it to
them in one sentence and ask what they think the app does. If the answer isn't "watch
sports with your friends," the design has failed and you should say what caused the
misread.
```

---

## Order to actually run them

| | Prompts | Output |
|---|---|---|
| 1 | 1.1 ×5, then 1.2 (pick 3) | ~8 directions |
| 2 | 1.3 → 1.4 → 1.5 | Your taste, encoded in a build prompt |
| 3 | Pick ONE. Then 2.1 until 9/10 | One direction at quality |
| 4 | 2.5, then 4.1 | The set, and the one real interaction |
| 5 | 3.1 → 3.2 → 3.3 → 3.4 | Shippable |
| 6 | 4.2, 4.3, 4.4 | Honest read before committing |

**Keys needed:** OpenAI *or* Gemini (2.3), fal.ai (2.4). Everything else runs as-is.
