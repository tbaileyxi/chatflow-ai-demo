// Where "Download" goes. One definition, because there were four.
//
// Three of them were wrong at the same time: the landing page and the pick-share
// page used '#' (a dead button with a "Soon" chip, for an app that had already
// shipped), and the invite page pointed at sidehuddlesports.com — so a friend
// following an invite, tapping Download, landed back on the website they came
// from. Every one of those is on the path a new user actually walks.
//
// Verified 2026-08-14: returns 200 as "Side Huddle Sports App".
export const APP_STORE_URL = 'https://apps.apple.com/us/app/id6777524558';

/**
 * The store link, tagged with which surface sent the person there.
 *
 * Apple counts `ct` (campaign token) separately in App Store Connect →
 * Analytics → Campaigns. Untagged, every button on the site lands in one
 * undifferentiated bucket: App Analytics can say "they came from your website"
 * but not whether the website did anything — chapter outreach, an invite from a
 * friend and a stray visit to the homepage were indistinguishable, which is
 * exactly the question worth answering after a send.
 *
 * Apple caps `ct` at 40 characters and it must survive a URL, so the label is
 * normalised rather than trusted. A missing or empty campaign returns the bare
 * URL, so an untagged caller is never worse off than before.
 *
 * No `pt` (provider token) here — that identifies a third-party ad network and
 * we are not one. `ct` alone is what populates Campaigns for first-party links.
 */
export function appStoreUrl(campaign?: string): string {
  const ct = (campaign ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return ct ? `${APP_STORE_URL}?ct=${ct}` : APP_STORE_URL;
}

/**
 * The campaign labels, in one place so a typo cannot quietly open a second
 * bucket that looks like a real one. Apple has no notion of a "wrong" ct — it
 * just starts counting whatever it is sent, forever.
 */
export const STORE_CAMPAIGN = {
  /** /t/<team> — the page every chapter outreach email points at. */
  chapterOutreach: 'chapter-outreach',
  /** The plain homepage. */
  landing: 'landing',
  /** Following a friend's huddle invite link. */
  invite: 'invite',
  /** Entering an invite code. */
  inviteCode: 'invite-code',
  /** A shared pick. */
  pickShare: 'pick-share',
} as const;
