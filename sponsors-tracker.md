# Side Huddle Sponsors — Outreach Tracker

Single source of truth for sponsor prospecting + outreach. Both `sponsor-lead-finder` and `sponsor-drafter` agents read/write this file. You (or Claude) update statuses manually as outreach progresses.

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

---

## Prospect log

Free-form notes per prospect. Newest entries on top per company. Add when something happens (sent, replied, call notes, etc).

### Bojangles
- **2026-05-06** — Drafted: 6-team Carolinas/ACC/SEC bundle, $1,200/mo. Hook: Bojangles Coliseum naming rights (NEEDS VERIFICATION before sending).
- **2026-05-06** — Researched via QSR lead-finder run. Top-3 priority. Notes: already sponsors Panthers + UNC + NC State; football is core brand DNA.
