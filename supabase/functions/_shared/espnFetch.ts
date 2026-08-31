// ESPN requires a User-Agent. Without one it returns 403 Access Denied — an
// HTML page, not JSON — and every caller here treats a failed fetch as "no
// data" rather than an error, so the failure is completely silent.
//
// That is exactly what happened: bot-live-poller reported games_seen: 0 with
// errors: [] while ESPN was serving 9 live games, and the Coach answered "I
// don't have the standings" because its team-index lookup came back empty.
// Nothing logged, nothing alerted, both features just quietly dead.
//
// Verified 2026-08-21: same URL, same second — with a UA, HTTP 200 and 9
// events; with no UA, HTTP 403.
//
// Use espnJson() for every ESPN request. Do not hand-roll fetch to ESPN.

export const ESPN_HEADERS: Record<string, string> = {
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
};

/**
 * Fetch JSON from ESPN. Returns null on any failure, and logs the status so a
 * block shows up in the function logs instead of vanishing into an empty array.
 */
export async function espnJson(
  url: string,
  timeoutMs = 8000,
): Promise<any | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: ESPN_HEADERS, signal: ctrl.signal });
    if (!res.ok) {
      console.warn(`[espn] HTTP ${res.status} ${url}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn(`[espn] fetch error ${url}`, err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
