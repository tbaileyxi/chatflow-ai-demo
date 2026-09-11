// Legal links surfaced in-app.
//
// THERE ARE TWO SEPARATE DOCUMENTS AND THEY ARE NOT INTERCHANGEABLE.
//
// EULA_URL (also exported as TERMS_URL for the paywall's sake) is Apple's
// standard licence — the agreement App Store Connect applies when you haven't
// uploaded a custom one.  Guideline 3.1.2(c) requires it on any screen selling
// an auto-renewing subscription, and the same link has to appear in the App
// Store description.  If we ever upload a custom EULA, point this at that.
//
// TOS_URL is OUR terms of service, and it is the one guideline 1.2 cares
// about: it carries the zero-tolerance clause for objectionable content, the
// 24-hour report commitment, and how blocking works.  Apple's EULA contains
// none of that, so pointing the signup agreement at it would fail review.
//
// Keep both in sync with the App Store Connect metadata.

export const EULA_URL =
  "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";

/** @deprecated Use EULA_URL for the licence, TOS_URL for our terms. */
export const TERMS_URL = EULA_URL;

export const TOS_URL = "https://www.sidehuddlesports.com/terms";
export const PRIVACY_URL = "https://www.sidehuddlesports.com/privacy";
