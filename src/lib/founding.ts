/**
 * PARTNER PRICING, for the web app (/sponsor, /outreach).
 *
 * MONTHLY, NOT PER SEASON. $500 a month for a pro team, $250 for a college,
 * billed by Square on a real subscription. The founding season rate is gone —
 * it closed Oct 2 2026 having sold nothing, and the per-season shape never
 * added up to a business at one partner per team.
 *
 * The server has its own copy in supabase/functions/_shared/founding.ts (the
 * subscription charges from it). Change BOTH, or the page and the charge
 * disagree.
 */

// THE PRICE WENT UP. MONTHLY IS HOW YOU PAY IT, NOT A DISCOUNT.
// The season rate rose to $2,500 on Oct 2 and stays there; $500 a month is
// five months of an NFL season said in a way a bar owner can agree to on the
// spot. Same money, smaller decision.
/** Per team, per month. */
export const PRO_MONTHLY = 500;
export const COLLEGE_MONTHLY = 250;

/** The list price the monthly rate is measured against. */
export const PRO_SEASON = 2500;
export const COLLEGE_SEASON = 1250;

const COLLEGE_LEAGUES = new Set(['NCAAF', 'NCAAB', 'NCAA']);

export const isCollegeLeague = (league: unknown) =>
  COLLEGE_LEAGUES.has(String(league ?? '').trim().toUpperCase());

export const monthlyForLeague = (league: unknown) =>
  isCollegeLeague(league) ? COLLEGE_MONTHLY : PRO_MONTHLY;

/** What a cart costs every month. Mixed carts add up; there is no bundle rate. */
export const monthlyTotal = (leagues: unknown[]) =>
  leagues.reduce<number>((sum, league) => sum + monthlyForLeague(league), 0);

/**
 * The one pricing sentence every pitch uses. Season first, month second — the
 * season number is the price, the monthly one is the terms.
 */
export const priceLine = () =>
  `$${PRO_SEASON.toLocaleString('en-US')} a season, or $${PRO_MONTHLY} a month. One partner per team.`;
