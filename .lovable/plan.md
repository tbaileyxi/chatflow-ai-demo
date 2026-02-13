

# Fix Kalshi Market Team Matching and NCAA Filtering

## Problem Summary

Two issues with the current `kalshi-sync-markets` edge function:

1. **Cross-league team mismatches**: The matching logic uses city names without league filtering, causing "Boston" NBA markets to match to the Bruins (NHL), "Houston" MLB to match Cougars (NCAA), "Dallas" NBA to Stars (NHL), etc. At least 20+ markets are incorrectly matched.

2. **NCAA scope too broad**: Currently syncing `KXNCAAB` (basketball) and `KXNCAAF` (football) but not filtering to men's sports only. Need to keep it limited to Men's College Basketball and Football.

## About Game-Day Markets

Kalshi game-day props (spreads, totals, who wins tonight) are **seasonal** -- they appear when leagues are actively playing. Right now all synced markets are long-term championship futures priced at 99 cents (essentially untradeable). When NBA/NHL resume and MLB starts, daily props will flow in automatically through the existing sync function.

## Solution

### 1. Fix team matching in `kalshi-sync-markets/index.ts`

**Current broken logic:**
- Builds a flat map of team names and cities
- Matches "Boston" in an NBA market title to whichever team named "Boston" it finds first (could be Bruins, Celtics, or Red Sox)

**New league-aware logic:**
- Map Kalshi series tickers to our database league values: `KXNBA` maps to `NBA`, `KXNFL` to `NFL`, `KXNHL` to `NHL`, `KXNCAAB`/`KXNCAAF` to `NCAA`, `KXMLB` to `MLB`
- When matching, only consider teams from the **same league** as the market's series ticker
- Build per-league team maps instead of one global map
- Match on full city+name first (longest match wins), then mascot name, then city -- all within the correct league only

**Matching priority (within correct league):**
1. Full name: "Los Angeles Dodgers" 
2. Mascot/team name: "Dodgers"
3. City: "Los Angeles" (only if unambiguous within that league -- skip if multiple teams share a city like LA, NY, Chicago)

### 2. NCAA filtering

- Keep both `KXNCAAB` and `KXNCAAF` series tickers
- These already represent Men's College Basketball and Men's College Football on Kalshi
- No additional filtering needed -- Kalshi's series tickers handle the sport separation

### 3. Clean up mismatched data

- After deploying the fixed function, re-sync all markets to correct the team assignments
- Run a one-time cleanup to null out incorrectly matched `team_id` values

## Technical Details

### File: `supabase/functions/kalshi-sync-markets/index.ts`

Changes:
- Replace the single flat `teamMap` with a league-grouped approach
- Pass the current league context into matching
- Skip ambiguous city matches (cities with multiple teams in same league like "Los Angeles" in MLB, "New York" in MLB/NBA/NFL)
- Add logging for match decisions to aid debugging

### Post-deploy: Data cleanup

Run via the edge function or SQL to:
- Clear all existing `team_id` values on `kalshi_markets`
- Re-trigger a sync to rebuild matches correctly

