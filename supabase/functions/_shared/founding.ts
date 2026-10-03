// PARTNER PRICING, server side: the checkout charges from this and the
// outreach emails quote it.
//
// MONTHLY, NOT PER SEASON. The season rate died on its own evidence — zero
// sold at $500 for a whole season, and the arithmetic never worked anyway:
// one partner per team, a hundred teams, $50k a year is not a business. A
// season is also the wrong unit to ask a bar to commit to in September.
//
// $500 a month for a pro team, $250 for a college. Billed by Square on a real
// subscription, cancellable, no prorating and no deadline to administer. The
// founding window is gone: it closed on Oct 2 2026 having sold nothing, and
// re-opening a deadline you already announced is how a deadline stops meaning
// anything.
//
// The web app has its own copy in src/lib/founding.ts (the page shows it).
// Change BOTH, or the page and the charge disagree.

// THE PRICE WENT UP. MONTHLY IS HOW YOU PAY IT, NOT A DISCOUNT.
//
// The season rate is $2,500 and that is the number in the pitch — it rose on
// Oct 2 and it stays risen. $500 a month is the same money said in a way a bar
// owner can agree to without asking anyone: five months of an NFL season,
// $2,500 either way. Nobody is being offered less than the last person was.
/** Per team, per month, in cents. */
export const PRO_MONTHLY_CENTS = 50000;
export const COLLEGE_MONTHLY_CENTS = 25000;

/** The list price the monthly rate is measured against. */
export const PRO_SEASON_CENTS = 250000;
export const COLLEGE_SEASON_CENTS = 125000;

// College is half because the buyer is different, not because the audience is
// worse. A shop two blocks from campus has a smaller budget than a regional
// brand — but a big school runs football into February and basketball into
// March, so eight months at $250 lands near five at $500 anyway. It is an
// opening price, and it moves when there are share numbers to argue from.
const COLLEGE_LEAGUES = new Set(["NCAAF", "NCAAB", "NCAA"]);

export const isCollegeLeague = (league: unknown) =>
  COLLEGE_LEAGUES.has(String(league ?? "").trim().toUpperCase());

export const monthlyCentsForLeague = (league: unknown) =>
  isCollegeLeague(league) ? COLLEGE_MONTHLY_CENTS : PRO_MONTHLY_CENTS;

/**
 * What a cart costs every month.
 *
 * Mixed carts just add up — three pro teams and a college is $1,750/mo. There
 * is no bundle discount, because a discount is a second number to explain and
 * the whole point of one-partner-one-price is that there is nothing to
 * negotiate.
 */
export const monthlyTotalCents = (leagues: unknown[]) =>
  leagues.reduce<number>((sum, league) => sum + monthlyCentsForLeague(league), 0);

const money = (cents: number) => `$${(cents / 100).toLocaleString("en-US")}`;

/** "$500" and "$250", from the cents the subscription actually charges. */
export const proPrice = money(PRO_MONTHLY_CENTS);
export const collegePrice = money(COLLEGE_MONTHLY_CENTS);
/** "$2,500" — the season figure the monthly rate is measured against. */
export const proSeasonPrice = money(PRO_SEASON_CENTS);
export const collegeSeasonPrice = money(COLLEGE_SEASON_CENTS);

/**
 * The one pricing sentence every pitch uses.
 *
 * Season first, month second, in that order — the season number is the price
 * and the monthly one is the terms. Lead with $500 and it reads as what the
 * thing costs, which makes the next conversation a negotiation down from a
 * number that was already the floor.
 */
export const priceLine = () =>
  `${proSeasonPrice} a season, or ${proPrice} a month. One partner per team.`;
