/**
 * THE FOUNDING RATE, for the web app (/sponsor, /outreach).
 *
 * Until FOUNDING_DEADLINE a team is $500; after it, $2,500 flat. Everything
 * reads the flip from here — the page, the running total, the pitch copy — so
 * nothing needs changing by hand when the window closes.
 *
 * The server has its own copy in supabase/functions/_shared/founding.ts (the
 * checkout charges from it). Move the date in BOTH files, or the page and the
 * charge disagree.
 */

/** When the founding rate ends, Eastern time. */
export const FOUNDING_DEADLINE = '2026-10-02T23:59:59-04:00';
export const FOUNDING_END = Date.parse(FOUNDING_DEADLINE);

/** Per team, per season. */
export const FOUNDING_PRICE = 500;
export const LIST_PRICE = 2500;

export const isFoundingOpen = (now = Date.now()) => now < FOUNDING_END;
export const seasonPrice = (now = Date.now()) => (isFoundingOpen(now) ? FOUNDING_PRICE : LIST_PRICE);

/** The one pricing sentence every pitch uses. */
export const priceLine = (now = Date.now()) =>
  isFoundingOpen(now)
    ? '$500 founding rate for the season. One partner per team.'
    : '$2,500 flat for the season. One partner per team.';
