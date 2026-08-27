# Outreach + team pages — state as of 2026-08-21

## Live in production
- **`/t/<slug>`** team sales pages, 15 teams (`src/pages/TeamLanding.tsx`). Team accent colour,
  real chapter counts, live ESPN schedule, download CTA. **Screenshots were removed** — the ones
  in `public/sponsor-screens/` are ~5 generations stale and don't reflect the current app.
- **`outreach-send`** (sponsors → `sponsor_leads`) and **`chapter-send`** (chapters → `chapter_leads`),
  both Brevo, both from `ty@sidehuddlesports.com`. SPF/DKIM/DMARC verified.
- `/outreach` preview panels now render the full email body, not just subject lines.

## Key decisions (do not re-litigate)
- Tagline: **"The digital tailgate"** / "Enhanced team chat rooms with your crew." Not "game-day app".
- `CHAPTER_SEED_ROOMS` is dead — never set. `/t/<slug>` replaced it.
- The iOS app is **live**: https://apps.apple.com/us/app/id6777524558
- Sponsor offer: **$2,500 season = $500 deposit + $2,000 Sept 1 or launch, whichever is later**.
  Square link: https://square.link/u/iq7jW1sF. Never refund — make good with inventory.
- Sponsor targets = local businesses that already sponsor college athletics (scraped by `sponsor-db/`).
  National brands are abandoned: nobody there can say yes.
- **Trademark**: never "official <team>", no club marks or logos. Team names describe fans only.
  Disclaimer renders in every email footer and on every team page.

## Nothing has been sent
`sponsor_leads` batch 4 is imported (region `College athletics batch 4`). `chapter_leads` has
~1,158 chapter leaders, all `status: new`, **never contacted**. Browns alone is 352 chapters /
131,059 members.

## To preview an email before sending, without deploying
`sponsor-db/` has the scraper. To render the real chapter templates locally, bundle
`supabase/functions/chapter-send/index.ts` with its imports stubbed and call `subject`/`body`.
This caught two live copy bugs that reading the template did not.

## Open work
1. **Team pages look AI-generated** — generic layout, stock phrasing, no real personality. Needs a
   proper design pass. This is the page 1,158 chapter leaders will judge the product by.
2. New app screenshots needed (per-team ideally) before putting images back on `/t/<slug>`.
3. The old App Store screenshot must be replaced in App Store Connect — user-only task.
4. CRM pipeline view for sponsors + chapters, kept separate. `sponsors-tracker.md` is unusable.
