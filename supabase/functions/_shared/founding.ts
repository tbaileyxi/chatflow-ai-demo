// THE FOUNDING RATE, server side: the checkout charges from this and the
// outreach emails quote it.
//
// Until FOUNDING_DEADLINE a team is $500; after it, $2,500 flat — no manual
// change at the deadline. The web app has its own copy in src/lib/founding.ts
// (the page shows it). Move the date in BOTH files, or the page and the charge
// disagree.

/** When the founding rate ends, Eastern time. */
export const FOUNDING_DEADLINE = "2026-10-02T23:59:59-04:00";
export const FOUNDING_END = Date.parse(FOUNDING_DEADLINE);

/** Per team, per season, in cents. */
export const FOUNDING_PRICE_CENTS = 50000;
export const LIST_PRICE_CENTS = 250000;

export const isFoundingOpen = (now = Date.now()) => now < FOUNDING_END;
export const seasonPriceCents = (now = Date.now()) =>
  isFoundingOpen(now) ? FOUNDING_PRICE_CENTS : LIST_PRICE_CENTS;

/** The one pricing sentence every pitch uses. */
export const priceLine = (now = Date.now()) =>
  isFoundingOpen(now)
    ? "$500 founding rate for the season. One partner per team."
    : "$2,500 flat for the season. One partner per team.";

// THE DATE AND THE NUMBERS, SPELLED OUT FROM THE SAME CONSTANTS.
//
// The follow-up letters name the deadline and the price in their own
// sentences rather than using priceLine(), and they were typed in by hand —
// "Oct 2", "$2,500". A hand-typed date is correct until it is not, and this
// one goes wrong silently on a Saturday morning while the emails keep going
// out. Deriving them means the copy cannot drift from the charge.

/** "Oct 2" — the deadline as a reader says it, in the timezone it is set in. */
export const deadlineDay = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "America/New_York",
}).format(FOUNDING_END);

const money = (cents: number) => `$${(cents / 100).toLocaleString("en-US")}`;

/** "$500" and "$2,500", from the cents the checkout actually charges. */
export const foundingPrice = money(FOUNDING_PRICE_CENTS);
export const listPrice = money(LIST_PRICE_CENTS);
