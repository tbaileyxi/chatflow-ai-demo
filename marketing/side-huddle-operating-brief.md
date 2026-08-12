# Side Huddle Sports — Operating Brief

_v1.0 · Aug 6, 2026 · internal. Everything below verified against live secrets, DNS, and shipped code — not from memory._

---

## 1. Who we are

**Canonical one-liner**

> Side Huddle is the digital tailgate — an AI-enhanced team chat where one fanbase splits into hundreds of small huddles.

**By audience**

| To | Say |
|---|---|
| Local sponsor | "A private gameday group chat for [Team] fans — live scores, plays, and a free pick'em running inside the thread." |
| Alumni / chapter staff | "A gameday room for your chapter. Live scores and a free pick'em in the thread. Virtual chips, no cash-out, rated 13+." |
| Investor / press | "Group chat is already where fans watch the game. We put the live game inside the thread and let the group compete in it." |
| Consumer / App Store | "Watch the game with your people. Live scores, plays, and picks — in one chat." |

**Tagline variations on "digital tailgate"**

- *Straight:* The digital tailgate. · Your digital tailgate. · The tailgate that travels. · Tailgate from anywhere.
- *Group-first:* One fanbase. Hundreds of huddles. · Everybody's watching. Nobody's alone. · The group chat that watches back. · Where your people watch.
- *Action:* Pull up. Pick 'em. Talk trash. · The game, in the thread. · Your section, wherever you are.

> On any school-affiliated send, pair the tagline with **"Virtual chips. No cash-out. 13+."** That sentence is what gets forwarded instead of deleted.

---

## 2. Features → benefits

| Feature | What the user gets | Why it matters to us |
|---|---|---|
| **Huddles** (private + public rooms) | Start a room for friends, or join your team's | The container. Retention lives here. |
| **Live game in the thread** | Scores, plays, momentum posted inline while you chat | No tab-switching. The reason to open during a game. |
| **The Coach** (AI bot) | A team-voiced bot reacting to real plays and breaking news | Makes a quiet room feel alive. Carries small huddles past the cold-start problem. |
| **Team feed** | Players, coaches, beat reporters curated in real time | A daily reason to open — off gameday. |
| **Pick'em + Predictions** | Free picks on moneyline, totals, and player props, priced on real lines | Competition. This is what makes people recruit their friends. |
| **Fade** (friend-vs-friend props) | Take the other side of a friend's pick | The growth wedge. **v1.1** — built, not shipped. |
| **Chips ledger** | Virtual currency, season-long standings | Stakes without money. Protects the 13+ rating. |
| **Rally / Ping + push** | "We're on" alerts tied to real events, not spam | Pulls the group in at kickoff. |
| **Team sponsor slot** | One exclusive local business per team | Revenue in v1.0, and local credibility for the fan. |

**Rating posture:** Simulated Gambling = None · Contests = Frequent → **13+**. Every external description must carry *virtual chips, no cash-out, no real money*.

---

## 3. Vendor & service map

### 3.1 Intelligence — which AI runs the bot

**We run Anthropic Claude in production.** Not ChatGPT. Confirmed against the live `LLM_PROVIDER` secret.

| Model | Job |
|---|---|
| `claude-haiku-4-5` | News one-liners + the headline relevance judge |
| `claude-sonnet-4-6` | The in-game "smart bot" — digests scores, runs, momentum |

OpenAI (`gpt-4o-mini`) and xAI Grok (`grok-2-latest`) are **fully wired but dormant**, sitting behind the same `LLM_PROVIDER` env var. Switching providers is a one-line secret change, not a deploy. Grok is also referenced by the X-content analyzer. That's real optionality — keep it.

**How the bot actually runs.** Two Edge Functions on cron:

- `bot-news-poller` → pulls team RSS (Google News + outlet feeds, which also supply the action photos) → **Haiku scores each headline for relevance** → survivors get rewritten into one bot line → posted into that team's huddles.
- `bot-live-poller` → pulls ESPN game state → **Sonnet** digests the actual play data into a reaction.

The hallucination control is architectural, not a prompt: **the model only rephrases facts handed to it. No search, no recall, no URLs.** A fact not in the payload cannot be said.

Live guardrails: 5 news posts per team per day · 6 teams per run · quiet 30 min before tip-off · excitement threshold 30.

### 3.2 Sports data

| Vendor | Job | Status |
|---|---|---|
| **ESPN site API** | Scores, plays, leaders | **Live primary** (`SPORTS_PROVIDER=espn`) |
| Highlightly | Alternate stats provider | Configured, swappable |
| **SportsGameOdds** | Lines + player props for Predictions/Fade | Live — **throttled to ~12 calls/day** after a 429 quota burn |
| the-odds-api | Secondary odds | Legacy |
| Kalshi + Polymarket | Prediction-market feeds for `/arena` | Configured |
| YouTube Data API | Highlights | Configured |

### 3.3 Content & social

RSS (Google News + outlet feeds) for bot news and photos · **X API v2** (bearer token, recent-search + lists) → `ingest-x-sources`, **runs every 6h unattended** → team feed · Reddit → `reddit-social-buzz`, hourly at :15.

### 3.4 Email — three vendors, three different jobs

This is the piece that gets conflated. It is not one provider.

| Vendor | Job |
|---|---|
| **Ionos** | The **domain and your mailboxes** — MX is `mx00/mx01.ionos.com`. Where `ty@sidehuddlesports.com` *receives*. It does not send campaigns. |
| **Brevo** | **Outbound campaigns** — sponsor outreach (`outreach-send`) and chapter sends (`chapter-send`), from `ty@sidehuddlesports.com`. Verified in DNS. |
| **Resend** | **In-app transactional/activity email**, from `updates.sidehuddlesports.com`. |

Current SPF: `v=spf1 include:_spf-us.ionos.com include:spf.brevo.com ~all`

⚠️ **Cold outreach volume ships from the root domain — the same domain as your app mail and your own inbox.** One spam-trap run damages all three. Move cold volume to a separate subdomain before scaling.

### 3.5 Money

**Stripe** — web checkouts, 7 webhooks (premium, membership, founding, badge, boost, sponsor, verification). **RevenueCat** — iOS IAP, entitlement `official_huddle_access`; paywall is built but **flag-disabled for 1.0** (`OFFICIAL_HUDDLES_ENABLED = false`). **Square** — configured in production, sponsor-checkout path exists, not the chosen route.

> Revenue in v1.0 is **sponsors**, not in-app purchase. That's deliberate — shipping a purchase the reviewer can't complete is an automatic rejection.

### 3.6 Platform

**Supabase** — Postgres, auth, realtime, storage, **73 Edge Functions**, 258 migrations, pg_cron. **Vercel** — sidehuddlesports.com (landing, invites, `/sponsors`, `/arena`, `/outreach`). **Expo / EAS** — iOS builds (must use `EAS_NO_VCS=1`). **Expo Push** — notifications. **Twilio** — phone/OTP auth + SMS. **Meta Graph** — Instagram posting.

### 3.7 The outreach machine

Apollo (contact data) · Hunter (email finding) · Google Places (local discovery) · `sponsor-db/` scraper (athletics partner pages) · `chapter-db/` scraper (1,382 chapters / 1,022 emails) · Brevo (send) · `sponsor_leads` table + `/outreach` dashboard.

---

## 4. V1 go-to-market

**Where we stand:** v1.0.0, `com.sidehuddle.sports`. Build 43 was rejected 8/6 under 3.1.2(c) for a missing EULA link in *metadata* — fixed metadata-only the same day and resubmitted. Nothing else blocks. **Kickoff (CFB Week 1) ≈ Aug 29 — 23 days.**

### 4.1 Audience — four buyers, four motives

Do not send one message to all of them.

| Who | What they're measured on | The ask that gets a yes |
|---|---|---|
| **Chapter president** (volunteer alum) | Turnout, chapter treasury | "Can I set up your chapter's room and send you a flyer?" |
| **Alumni association staff** (university employee) | Engagement %, event turnout, donor pipeline | One chapter as a pilot + a monthly one-pager they can show a board |
| **Fan club / FB group admin** (unpaid volunteer) | Status, and not doing work | "I'll build it, you pin it." |
| **Local business already sponsoring college athletics** | Reaching a fanbase they already pay for | $2,500/season |

The sponsor list is already scraped: **183 rows / 172 companies** (Clemson, Texas A&M, Penn State, Browns) — 140 local, ~40% email-findable, ~80% reachable counting phone. **For this buyer, phone beats email.**

### 4.2 Leaders for distribution

The unlock is not users, it's **leaders**. One chapter president delivers 40–400 people; one ad delivers one.

**Ladder the ask.** Never open with "tell your membership":

1. "Can I stand up your chapter's room and send you the flyer?" — a yes with zero work attached
2. One watch party as a pilot, QR flyer on the tables
3. Newsletter mention + chapter-wide push
4. Inter-chapter league — **the only rung that recruits the next chapters for you**

**Ship the work already done.** Every send carries these as attachments, never as requests: finished FB/newsletter copy (short + long) · an FB + IG story graphic · a QR flyer PDF with their chapter name already on it · a pre-built room link, chapter named · one line for the pinned post. *If the director has to write anything, it does not happen.*

**Incentive stack — pick two, not six.** Free: named room, chapter leaderboard, direct support line. Status: "Founding Chapter" badge, named in launch posts. Proof: the monthly one-pager. Competition: inter-chapter pick'em with a season trophy — the only self-spreading incentive. Money: recurring share if the chapter brings the sponsor for their team's slot.

> **Money goes to the organization, status goes to the person.** A per-signup bounty paid to a university employee or nonprofit board member is a conflict-of-interest problem, and it kills yeses you never hear about.

**Where they are:** alumni chapter directories · official fan-club and watch-party-bar lists · `[Team] fans of [City]` Facebook groups · Meetup · team subreddit sidebars. **The watch-party bar is often a better first contact than the chapter** — it has both the sponsor money and the turnout motive.

**Timing is not soft.** Alumni engagement calendars lock in August, and after Labor Day nothing new gets added until basketball. "Before kickoff" is a genuine deadline, and we are inside it.

### 4.3 Best practices — non-negotiable

1. **Lead with the gambling denial.** Line one to any school address: *"Chips are virtual, there is no cash-out, no real money changes hands, and the app is rated 13+."* A university employee will not forward anything that smells like betting.
2. **Under ~120 words** on cold email.
3. **No trademarks.** Never "Official [School] Partner." No marks, no logos — describe the audience only ("Clemson fans").
4. **Never cut the headline price.** If replies stall, cut the *deposit*. A falling price advertises weak demand.
5. **Cover downside with a makegood, not a refund** — an extra season or extra inventory costs nothing at zero marginal cost.
6. **Never benchmark our price against their rights-holder deal** (Learfield/JMI). It reads adversarial and invites "so you're worth less."
7. **Phone > email** for local sponsors; **email > phone** for alumni staff.
8. **Do not re-propose** — already failed: national brands, running our own watch parties, minor-league/junior clubs, grants/accelerators, Dutch auction.

### 4.4 AI agents — what to automate, what to keep human

**Running today**

| Agent | Does | Human still does |
|---|---|---|
| `sponsor-blitz` | Category brief → N qualified prospects + full LinkedIn sequence (connection note, first DM, follow-up), paste-ready | Sends each message by hand |
| `sponsor-db/` scraper | Athletics partner pages → company + contact rows | Qualifies |
| `chapter-db/` scraper | 1,382 chapters, 1,022 emails | Segments |
| `outreach-enrich` | Apollo + Hunter + Places → fills `sponsor_leads` | Approves |
| `outreach-send` | Brevo send, per-team personalization, disclaimer footer | Approves the batch |
| **The Coach** | Writes every in-app post | Nothing — autonomous by design |

**Build next, in this order**

1. **Kit generator** — chapter name in → QR flyer PDF + FB/IG graphic + two post copies + pre-built room link out. Biggest multiplier available: §4.2 requires a finished kit on every send, and hand-building them is what will cap you at ~10 sends/day.
2. **Reply triage** — classify inbound as interested / objection / not-now / dead, draft the reply, write the tracker row. Manual today; it's the first thing that breaks at volume.
3. **Monthly one-pager generator** — members activated, gamedays active, messages, picks, per chapter → rendered slide → sent. §4.2 calls this what buys the chapter-wide push, and it's pure DB→PDF. Never hand-make it.

**Keep human:** the actual send on anything school-affiliated, any pricing concession, and every phone call. The agent drafts; you press send.

---

## 5. Open items — ordered

1. **Verify the Anthropic account has credits.** The bot went dark in June from an empty balance, not a bug. If billing is dry on Aug 29, the product looks broken on its biggest day of the year. Set a balance alert.
2. **Sponsor pricing contradicts itself in three places.** Current offer is **$2,500/season** ($500 deposit + $2,000 at launch). But `sponsors-tracker.md` still carries $250/$650/$1,200/$1,800 monthly bundles across ~40 national rows, and the chapter playbook's revenue-share math is built on the old $250/mo. Reconcile before any chapter or sponsor send goes out.
3. **Move cold outreach off the root domain** — deliverability risk to app mail and your own inbox.
4. **Decide the mascot-name question.** `HUDDLE_LABELS` in `outreach-send` maps schools to mascots ("Tiger", "Demon Deacon"). Mascot names are trademarks too.
5. **Confirm the X bearer token is still valid** — last rotated Aug 2025, and `ingest-x-sources` runs unattended every 6h.
6. **Sponsor inventory is entirely unsold with 23 days to kickoff.** Every tracker row reads `Drafted`. The 172-company pivot list is scraped but not worked.
7. **App Store** — waiting on review of the metadata fix.

---

## 6. Manual database state — not reproducible from this repo

Changes made directly to the production database on **2026-08-07**. Rebuilding the
project from source alone will NOT restore these.

| What | Detail |
|---|---|
| **56 college huddles seeded** | Every NCAA team now has an official "… Community" huddle. These are content buffers, not user-facing rooms — `backfillTeamContent` copies their last 24h into any user-created room for that team. Exactly one per team; a second breaks backfill (`.maybeSingle()`). |
| **Two team rows corrected** | `Utah \| Utah Hockey Club` → `Utah \| Mammoth` (franchise rebrand). `Pitt \| Panthers` → `Pittsburgh \| Panthers` (ESPN sends "Pittsburgh Panthers"; "Panthers" is a shared nickname so there was no fallback). Both resolved to nothing before this. |
| **Two corrupt game rows reset** | `espn-nfl-401872926` and `espn-nfl-401872661` — future Week 2 games wrongly marked `final` carrying the Aug 6 Panthers/Cardinals score. Reset to `scheduled`, scores nulled. |
| **Two cron jobs disabled** | `arena-live-odds-every-2min` and `arena-sync-events-every-2min` (jobids 44, 45) set `active = false`. They ran every 2 minutes against SportsGameOdds for a World Cup that ended in July, consuming ~1,440 calls/day and starving the props sync. Re-enable with `SELECT cron.alter_job(44, active := true);` |

**Known-open, vendor-side:** SportsGameOdds is rate-limited (props dark since
2026-06-25); Supabase org is over quota with a restriction date of 2026-09-04.
Neither is a code problem.

**Unverified:** football prop `statID`s in `odds-sync-markets` are written from
SGO's naming convention, not confirmed against a live response. First successful
run reports the real ones in `unknown_prop_stats`. College team-name matching
against SGO's `names.long` is also unconfirmed — watch `skipped_no_tracked_team`.

**2026-08-12 — market ladder pruned.** The Kalshi expansion imported every strike
of every total/spread ladder (Over 4.5, 5.5, 7.5 …), leaving ~22 near-identical
cards per game and 34 in one Mets room. `kalshi-sync-markets` now keeps only the
line closest to 50c; a one-off `prune-ladder-markets` function deleted the 1,441
rows already written (120 kept, 0 had a fade against them, verified with the
service role). Result: totals 1.0 card/game, spreads 2.0 (one per side).
