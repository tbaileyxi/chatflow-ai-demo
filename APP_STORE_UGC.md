# App Store — user-generated content (guideline 1.2)

Video reactions make Side Huddle a UGC app. Apple's guideline 1.2 asks for
**four** things, and rejects for any one of them missing. Three are now built.
**The fourth is copy, and it isn't published yet.**

---

## What's built

| Requirement | Where |
|---|---|
| **Filter objectionable content** | Rate limit + 10s/10MB cap on capture; reports queue to `message_reports` |
| **Report mechanism** | Long-press any message → flag. One tap, on the content itself. |
| **Block abusive users** | Long-press → block. Enforced by RLS — a blocked person is invisible at the database, not filtered in the client. |
| **Remove content** | Delete your own message; room owners and admins can remove anything in their room. |

Applied via `RUN_THIS_UGC_POLICY.sql`. **Do not submit before it has been run** —
reporting and blocking will fail silently, which reviewers do test.

---

## What is NOT done — publish before submitting

### 1. Terms with a zero-tolerance clause — ✅ DONE 2026-09-10

Published at `/terms` (`src/pages/Terms.tsx`), linked from the site footer and
in the sitemap. **Note there are now two legal documents and they are not
interchangeable:** `EULA_URL` is Apple's standard licence, required on the
subscription paywall under 3.1.2(c); `TOS_URL` is ours and carries the clause
below. Pointing the signup agreement at Apple's EULA would fail review.

The published wording:

> **Objectionable content and abusive behaviour**
>
> Side Huddle has zero tolerance for objectionable content or abusive users.
> You may not post content that is unlawful, hateful, harassing, threatening,
> sexually explicit, or that depicts violence or the exploitation of any person.
>
> Anyone can report a message from inside the app by pressing and holding it.
> **We review every report within 24 hours** and remove content and terminate
> accounts that violate these terms.
>
> You can block any other person at any time, from the same menu. A blocked
> person's messages become invisible to you everywhere in Side Huddle, and they
> are not told that you blocked them.
>
> By posting to Side Huddle you agree to these terms.

**"Within 24 hours" is a commitment, not a formality.** Reviewers have rejected
apps for stating a window and having no way to meet it. If you can't watch the
queue daily, say **48 hours** — an honest longer window passes; a missed
promised one is worse than a slower one.

### 2. Agreement at signup

The terms have to be *agreed to*, not merely available. Add one line under the
Continue button on the name step of onboarding:

> By continuing you agree to the Terms and Privacy Policy.

with both words tappable. **✅ DONE** — on the name step of `OnboardingScreen`,
which is the moment the account comes into existence, and the step Apple checks
by walking the signup.

### 3. App Store Connect review notes

Paste this into App Review Information → Notes:

```
Side Huddle is a group chat for watching live sports with people you know.

USER-GENERATED CONTENT
Members can post text, photos, voice notes and short video reactions
(10 seconds max) into private rooms they were invited to.

MODERATION
• Report: press and hold any message → flag icon. Reports queue for review.
• Block: same menu → block. Blocked users are hidden at the database level
  across the entire app, not just in one room.
• Remove: users can delete their own messages; room owners and admins can
  remove anything in their room.
• Terms with a zero-tolerance clause are agreed at signup and published at
  sidehuddlesports.com/terms. Reports are reviewed within 24 hours.

DEMO ACCOUNT
Phone: +1 203 555 0142
Code:  123456
Sign-in is by SMS code. Enter the number above, then enter 123456 when
prompted. NO TEXT WILL ARRIVE — this is a registered test account and the
code is fixed.
```

**That last paragraph matters more than it looks.** Without it a reviewer
enters the number, waits for a text that will never come, and rejects for a
broken login.

### 4. Seed the reviewer account

`+1 203 555 0142` exists but is empty. A reviewer landing in a blank app is
how you get *"we were unable to evaluate the core functionality."* Sign in as
it once and put it in two or three rooms with real messages in them.

---

## Age rating

Current declaration is 13+ with Simulated Gambling: None, Contests: Frequent.
**UGC video does not by itself force a higher rating**, but the questionnaire
now has to answer yes to user-generated content. Answering it honestly with the
moderation above in place is the intent of the rating, not a risk to it.

---

## Order to do it

```
1. Run RUN_THIS_UGC_POLICY.sql          ← done
2. Run RUN_THIS_GAME_RSVP.sql           ← done
3. Publish /terms with the clause above ← done (deploy the web app)
4. Add the agreement line to onboarding ← done
5. Run RUN_THIS_NEXT.sql                ← OUTSTANDING
6. Seed the reviewer account            ← OUTSTANDING
7. Paste the review notes               ← OUTSTANDING
8. Submit
```

**Deploying the web app is part of step 3.** The page exists in the repo; until
it is live at `sidehuddlesports.com/terms` the signup screen still links to a
404, which is the same rejection as not having written it.

### Blocking and reporting a PERSON — added 2026-09-10

Block and report used to hang only off a long-press on a message. If the person
deleted the message, or the problem was the profile itself, there was no route
at all — and the profile is where a reviewer looks first. Both now sit on
`PublicProfileScreen`, and `message_reports.message_id` is nullable so a report
can name a person rather than a message (`RUN_THIS_NEXT.sql`).


---

## Retention — corrected 2026-09-11

The Terms used to say media was "stored for up to 90 days and then deleted
automatically." **Nothing in the codebase ever did that** — no TTL, no cleanup
job. A published promise to delete that we did not keep is worse than no
promise at all, and worse than the reverse.

The product decision is that a huddle should become a memory of the event
rather than evaporate, so the text now matches the behaviour: nothing expires,
and removal is by hand — your own messages, an owner or admin removing anything
in their room, or account deletion taking your messages with it.

**If a retention window is ever wanted, build the job first and change the text
second.**
