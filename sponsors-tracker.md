# Side Huddle Sponsors — Outreach Tracker

Single source of truth for sponsor prospecting + outreach. The `sponsor-blitz` agent reads/writes this file. You (or Claude) update statuses manually as outreach progresses.

## How to update

Just talk to Claude in plain English. Examples:

- *"Mark Bojangles as Sent"* → updates Status, bumps Last Touch to today
- *"Bojangles replied — booking a call Thursday"* → Status: `Replied`, appends a log note
- *"Mark Marco's Pizza as Dead — they said no thanks"* → Status: `Dead`
- *"Who haven't I followed up with in 7+ days?"* → Claude scans the table and lists them
- *"Show me everyone in Drafted status"* → filtered list
- *"What's my pipeline value?"* → sums $/mo across active prospects

## Status definitions

| Status | Meaning |
|--------|---------|
| `Researched` | Lead-finder added them. No outreach yet. |
| `Drafted` | Drafter wrote the messages. Not sent yet. |
| `Sent` | Connection note sent on LinkedIn. Awaiting accept. |
| `Connected` | They accepted the connection. First DM sent or pending. |
| `Replied` | They responded. Active conversation. |
| `Booked` | Meeting scheduled. |
| `Won` | Signed as sponsor. 🏆 |
| `Dead` | No-go. Logged so we don't re-pitch. |

---

## Pipeline

| Date Added | Company | Contact | Title | Category | Bundle | $/mo | LinkedIn | Status | Last Touch | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 2026-05-06 | Bojangles | — | VP Marketing | QSR | Panthers + UNC + NC State + Clemson + USC + Tennessee | $1,200 | [search](https://www.linkedin.com/search/results/people/?keywords=Bojangles%20VP%20Marketing) | Drafted | 2026-05-06 | Bojangles Coliseum naming-rights hook (verify); Carolinas/ACC/SEC fit |
| 2026-05-06 | Sonic Automotive | — | VP Marketing | Auto Dealer Group | — | — | [search](https://www.linkedin.com/search/results/people/?keywords=Sonic%20Automotive%20VP%20Marketing) | Researched | 2026-05-06 | ~110 dealerships across 14 states; HQ Charlotte; longtime Panthers/Charlotte FC sponsor; overlaps Panthers, Falcons, Texans, Broncos, Titans markets |
| 2026-05-06 | Lithia Motors (Lithia & Driveway) | — | VP Marketing | Auto Dealer Group | — | — | [search](https://www.linkedin.com/search/results/people/?keywords=Lithia%20Motors%20VP%20Marketing) | Researched | 2026-05-06 | Largest US dealer group by revenue; ~290 stores; broad NFL/CFB market overlap (Pacific NW, TX, Southeast); active local sports advertiser |
| 2026-05-06 | Group 1 Automotive | — | VP Marketing | Auto Dealer Group | — | — | [search](https://www.linkedin.com/search/results/people/?keywords=Group%201%20Automotive%20VP%20Marketing) | Researched | 2026-05-06 | HQ Houston; ~200+ US dealerships; Houston Texans/Astros sponsor history; strong TX + Southeast NFL/CFB footprint |
| 2026-05-06 | AutoNation | — | VP Marketing | Auto Dealer Group | — | — | [search](https://www.linkedin.com/search/results/people/?keywords=AutoNation%20VP%20Marketing) | Researched | 2026-05-06 | Largest US auto retailer by store count; ~340 locations; longtime Dolphins/Marlins sponsor; national scale across NFL/CFB markets |
| 2026-05-06 | Penske Automotive Group | — | VP Marketing | Auto Dealer Group | — | — | [search](https://www.linkedin.com/search/results/people/?keywords=Penske%20Automotive%20VP%20Marketing) | Researched | 2026-05-06 | ~150 US dealerships; Penske brand heavily tied to motorsports/sports; multi-market NFL/CFB overlap (Detroit, NY, CA, FL) |
| 2026-05-06 | Hendrick Automotive Group | — | VP Marketing | Auto Dealer Group | — | — | [search](https://www.linkedin.com/search/results/people/?keywords=Hendrick%20Automotive%20VP%20Marketing) | Researched | 2026-05-06 | ~95 dealerships; HQ Charlotte; Hendrick Motorsports parent — sports-marketing DNA; deep Carolinas/ACC/SEC fit (Panthers, UNC, NC State, Clemson) |
| 2026-05-06 | Ken Garff Automotive Group | — | VP Marketing | Auto Dealer Group | — | — | [search](https://www.linkedin.com/search/results/people/?keywords=Ken%20Garff%20VP%20Marketing) | Researched | 2026-05-06 | ~60 dealerships in 11 western states; Utah Jazz/BYU/Utah football sponsor; expanding into TX/AZ/CA — multi-CFB market |
| 2026-05-06 | Berkshire Hathaway Automotive | — | VP Marketing | Auto Dealer Group | — | — | [search](https://www.linkedin.com/search/results/people/?keywords=Berkshire%20Hathaway%20Automotive%20VP%20Marketing) | Researched | 2026-05-06 | ~80 dealerships, primarily TX (Van Tuyl legacy); Cowboys/Texans/Astros + multiple CFB markets (TCU, Baylor, A&M, UT) |

---

## Prospect log

Free-form notes per prospect. Newest entries on top per company. Add when something happens (sent, replied, call notes, etc).

### Bojangles
- **2026-05-06** — Drafted: 6-team Carolinas/ACC/SEC bundle, $1,200/mo. Hook: Bojangles Coliseum naming rights (NEEDS VERIFICATION before sending).
- **2026-05-06** — Researched via QSR lead-finder run. Top-3 priority. Notes: already sponsors Panthers + UNC + NC State; football is core brand DNA.

### Sonic Automotive
- **2026-05-06** — Researched via auto dealer lead-finder run. Charlotte-HQ public dealer group (~110 stores, 14 states); longtime Carolina Panthers and Charlotte FC partner; overlaps Panthers/Falcons/Texans/Broncos/Titans markets — strong multi-team bundle candidate.

### Lithia Motors (Lithia & Driveway)
- **2026-05-06** — Researched via auto dealer lead-finder run. Largest US dealer group by revenue (~290 stores) with footprint across Pacific NW, TX, Southeast — broad NFL/CFB market overlap for a national bundle pitch.

### Group 1 Automotive
- **2026-05-06** — Researched via auto dealer lead-finder run. Houston-HQ public group (~200+ US dealerships); existing Texans/Astros sponsor history; strong TX + Southeast NFL/CFB overlap.

### AutoNation
- **2026-05-06** — Researched via auto dealer lead-finder run. Largest US auto retailer by store count (~340); longtime Dolphins/Marlins sponsor; national scale makes a 10+-team bundle viable.

### Penske Automotive Group
- **2026-05-06** — Researched via auto dealer lead-finder run. ~150 US dealerships; Penske brand has deep motorsports/sports identity; multi-market NFL/CFB overlap (Detroit, NY, CA, FL).

### Hendrick Automotive Group
- **2026-05-06** — Researched via auto dealer lead-finder run. ~95 dealerships, Charlotte-HQ; sister to Hendrick Motorsports — sports-marketing is core DNA; ideal Carolinas/ACC/SEC bundle fit.

### Ken Garff Automotive Group
- **2026-05-06** — Researched via auto dealer lead-finder run. ~60 dealerships across 11 western states; Utah Jazz / BYU / Utah football sponsor; expanding into TX/AZ/CA opens multi-CFB-market potential.

### Berkshire Hathaway Automotive
- **2026-05-06** — Researched via auto dealer lead-finder run. ~80 dealerships, mostly TX (former Van Tuyl); Cowboys/Texans/Astros markets plus TCU/Baylor/A&M/UT — natural multi-team Texas bundle.
