import { useEffect } from "react";

/**
 * A self-referencing canonical tag for the page currently on screen.
 *
 * WHY THIS EXISTS: every URL on this site is served the same index.html — see
 * the catch-all rewrite in vercel.json — so the 181 /t/<slug> pages are, to a
 * crawler fetching HTML, 181 identical documents. Search Console flagged them
 * as duplicate-without-canonical, which is the correct reading of what was
 * served.
 *
 * The answer is a canonical on each, not deleting them: they are real pages
 * with real content once React runs, and they are where the outreach emails
 * and the App Store traffic land.
 *
 * HONEST LIMIT: this writes the tag from JavaScript. Google renders JS and
 * picks it up, and it is a genuine improvement over no tag at all — but a tag
 * in the served HTML would be stronger. That needs prerendering, which this
 * stack does not have today.
 *
 * Query strings are dropped deliberately: /t/browns?utm=x is the same page as
 * /t/browns and should say so.
 */
export function useCanonical(path?: string): void {
  useEffect(() => {
    const url = `https://www.sidehuddlesports.com${path ?? window.location.pathname}`;

    let tag = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!tag) {
      tag = document.createElement("link");
      tag.rel = "canonical";
      document.head.appendChild(tag);
    }
    tag.href = url;

    return () => {
      // Left in place on unmount rather than removed: the next route sets its
      // own, and a page with no canonical between renders is the state we are
      // trying to get out of.
    };
  }, [path]);
}
