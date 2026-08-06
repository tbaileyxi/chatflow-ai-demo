// Feature flags.
//
// OFFICIAL_HUDDLES_ENABLED gates the paid "Official Huddle" upgrade ($29/mo via
// RevenueCat). It's OFF for the 1.0 App Store submission: the subscription
// product isn't set up in App Store Connect yet, and shipping a purchase the
// reviewer can't complete is an automatic rejection. Flip this to true in the
// update that adds monetization, once `official_huddle_monthly` exists in App
// Store Connect and is wired to a RevenueCat offering. Nothing else needs to
// change — the paywall and purchase code already work behind this flag.
export const OFFICIAL_HUDDLES_ENABLED = false;
