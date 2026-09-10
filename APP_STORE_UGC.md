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

### 1. Terms with a zero-tolerance clause

Apple wants this in writing, reachable from the app and from the App Store
listing. Add to your terms at `sidehuddlesports.com/terms`:

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

with both words tappable. **Not built yet** — it's a small change to
`OnboardingScreen`, and it's the one Apple checks by walking the signup.

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
2. Run RUN_THIS_GAME_RSVP.sql           ← still outstanding
3. Publish /terms with the clause above
4. Add the agreement line to onboarding
5. Seed the reviewer account
6. Paste the review notes
7. Submit
```

Steps 3 and 4 are the ones that get you rejected if skipped, and they're the
two nobody remembers because they aren't code.
