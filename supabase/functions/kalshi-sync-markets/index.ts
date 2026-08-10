import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const KALSHI_BASE = 'https://api.elections.kalshi.com/trade-api/v2';

// Series tickers for sports markets on Kalshi.
// Include both season/championship series AND per-game series so the feed
// shows day-of and in-game cards (not just Feb 2027 futures).
// NOTE: MLB is intentionally NOT here. MLB markets now come exclusively from
// The Odds API (odds-sync-markets) — richer lines (moneyline/spread/total, props
// next) than Kalshi's thin baseball coverage. Syncing both would double-post
// cards into MLB rooms. Other leagues stay on Kalshi until they get the same
// Odds API treatment.
const SPORT_SERIES: Record<string, string[]> = {
  MLB: ['KXMLBGAME', 'KXMLBSPREAD', 'KXMLBTOTAL'],
  NBA: ['KXNBA', 'KXNBAGAME'],
  NFL: ['KXNFL', 'KXNFLGAME', 'KXNFLSPREAD', 'KXNFLTOTAL'],
  NHL: ['KXNHL', 'KXNHLGAME'],
  NCAA: ['KXNCAAB', 'KXNCAAF', 'KXNCAABGAME', 'KXNCAAFGAME',
         'KXNCAAFSPREAD', 'KXNCAAFTOTAL'],
};

// market_type derived from the SERIES, never from the title. Title text lies:
// "San Diego wins by over 3.5 runs?" contains "win", so the old keyword sniff
// classified a spread as a winner market. Series ticker is unambiguous.
// Anything not listed falls back to the keyword sniff below.
const SERIES_MARKET_TYPE: Record<string, string> = {
  KXMLBGAME: 'winner',   KXNFLGAME: 'winner',   KXNBAGAME: 'winner',
  KXNHLGAME: 'winner',   KXNCAAFGAME: 'winner', KXNCAABGAME: 'winner',
  KXMLBSPREAD: 'spread', KXNFLSPREAD: 'spread', KXNCAAFSPREAD: 'spread',
  KXMLBTOTAL: 'total',   KXNFLTOTAL: 'total',   KXNCAAFTOTAL: 'total',
};

// Series whose markets describe the WHOLE game rather than one side, so the
// card belongs in both teams' rooms (the title names both, e.g. "Milwaukee vs
// San Diego Total Runs?").
const GAME_LEVEL_SERIES = new Set([
  'KXMLBTOTAL', 'KXNFLTOTAL', 'KXNCAAFTOTAL',
]);

// Map series ticker -> our DB league value
const TICKER_TO_LEAGUE: Record<string, string> = {
  KXNBA: 'NBA',
  KXNBAGAME: 'NBA',
  KXNFL: 'NFL',
  KXNFLGAME: 'NFL',
  KXNHL: 'NHL',
  KXNHLGAME: 'NHL',
  KXNCAAB: 'NCAA',
  KXNCAABGAME: 'NCAA',
  KXNCAAF: 'NCAA',
  KXNCAAFGAME: 'NCAA',
  KXMLB: 'MLB',
  KXMLBGAME: 'MLB',
  KXMLBSPREAD: 'MLB',
  KXMLBTOTAL: 'MLB',
  KXNFLSPREAD: 'NFL',
  KXNFLTOTAL: 'NFL',
  KXNCAAFSPREAD: 'NCAA',
  KXNCAAFTOTAL: 'NCAA',
};

interface TeamRecord {
  id: string;
  name: string;
  city: string;
  league: string;
}

// Kalshi uses abbreviated names for multi-team cities and short names for NCAA.
// Map: league -> kalshi abbreviation -> our team name (mascot).
const KALSHI_ALIASES: Record<string, Record<string, string>> = {
  MLB: {
    'los angeles d': 'Dodgers',
    'los angeles a': 'Angels',
    'new york y': 'Yankees',
    'new york m': 'Mets',
    'chicago c': 'Cubs',
    'chicago ws': 'White Sox',
    "a's": 'Athletics',
  },
  NBA: {
    'los angeles l': 'Lakers',
    'los angeles c': 'Clippers',
    'new york k': 'Knicks',
    'new york n': 'Nets',  
  },
  NFL: {
    'los angeles r': 'Rams',
    'los angeles ch': 'Chargers',
    // Kalshi truncates to "Los Angeles C" in per-game subtitles, which the
    // longer 'los angeles ch' key never matched — seen unrouted 2026-08-07.
    // Aliases are tried longest-first, so 'los angeles ch' still wins when
    // present and this only catches the shorter form. Rams are 'los angeles r'
    // so there is no collision.
    'los angeles c': 'Chargers',
    'new york g': 'Giants',
    'new york j': 'Jets',
  },
  NCAA: {
    'ohio st.': 'Buckeyes',
    'ohio st': 'Buckeyes',
    'ohio state': 'Buckeyes',
    'penn st.': 'Nittany Lions',
    'penn st': 'Nittany Lions',
    'penn state': 'Nittany Lions',
    'miami (fl)': 'Hurricanes',
    'miami (oh)': 'RedHawks',
    'ole miss': 'Rebels',
    'tulane': 'Green Wave',
    'james madison': 'Dukes',
  },
};

// For NCAA teams with duplicate mascots (e.g. multiple "Tigers"), 
// map alias -> city so we can match by city+name instead of just mascot
const ALIAS_TO_CITY: Record<string, Record<string, string>> = {
  NCAA: {
    'auburn': 'Auburn',
    'lsu': 'LSU',
    'tennessee': 'Tennessee',
  },
};

/**
 * Build per-league matching structures.
 * Returns a map: league -> { fullNames, mascots, cities }
 * where each sub-map goes from lowercase search term -> team record.
 * Cities that are ambiguous (multiple teams share the same city within a league) are excluded.
 */
function buildLeagueTeamMaps(teams: TeamRecord[]) {
  const leagueTeams = new Map<string, TeamRecord[]>();
  for (const t of teams) {
    const list = leagueTeams.get(t.league) || [];
    list.push(t);
    leagueTeams.set(t.league, list);
  }

  const result = new Map<string, {
    fullNames: Map<string, TeamRecord>;
    mascots: Map<string, TeamRecord>;
    cities: Map<string, TeamRecord>;
  }>();

  for (const [league, roster] of leagueTeams.entries()) {
    const fullNames = new Map<string, TeamRecord>();
    const mascots = new Map<string, TeamRecord>();
    const cityCount = new Map<string, number>();
    const cityMap = new Map<string, TeamRecord>();

    const mascotCount = new Map<string, number>();
    const mascotMap = new Map<string, TeamRecord>();

    for (const t of roster) {
      const full = `${t.city} ${t.name}`.toLowerCase();
      fullNames.set(full, t);

      const mascotKey = t.name.toLowerCase();
      mascotCount.set(mascotKey, (mascotCount.get(mascotKey) || 0) + 1);
      mascotMap.set(mascotKey, t);

      const cityKey = t.city.toLowerCase();
      cityCount.set(cityKey, (cityCount.get(cityKey) || 0) + 1);
      cityMap.set(cityKey, t);
    }

    // Mascots get the same ambiguity guard cities already had. Inside NCAA,
    // "Tigers" belongs to Missouri, Auburn, LSU and Clemson, and "Wildcats" to
    // four more — a bare-mascot title was silently resolving to whichever
    // loaded last, routing a market to the wrong school's rooms. A shared
    // mascot cannot identify a team, so refuse it and let the city/full-name
    // paths (which do work — Kalshi's per-game subtitle is the school) decide.
    for (const [mascot, count] of mascotCount.entries()) {
      if (count === 1) mascots.set(mascot, mascotMap.get(mascot)!);
    }

    // Only keep unambiguous cities (exactly 1 team with that city in this league)
    const safeCities = new Map<string, TeamRecord>();
    for (const [city, count] of cityCount.entries()) {
      if (count === 1) {
        safeCities.set(city, cityMap.get(city)!);
      }
    }

    result.set(league, { fullNames, mascots, cities: safeCities });
  }

  return result;
}

/**
 * Match a market title to a team within the correct league.
 * Priority: full name (longest match) > mascot > city (unambiguous only)
 */
function matchTeam(
  title: string,
  league: string,
  leagueMaps: ReturnType<typeof buildLeagueTeamMaps>,
): { team: TeamRecord | null; matchType: string } {
  const maps = leagueMaps.get(league);
  if (!maps) return { team: null, matchType: 'no_league_data' };

  const titleLower = title.toLowerCase();

  // 0a. Check city-based aliases first (for duplicate mascots like "Tigers")
  const cityAliases = ALIAS_TO_CITY[league] || {};
  const cityAliasSorted = Object.entries(cityAliases).sort((a, b) => b[0].length - a[0].length);
  for (const [alias, city] of cityAliasSorted) {
    if (titleLower.includes(alias)) {
      const fullKey = `${city.toLowerCase()} `;
      // Find team whose full name starts with this city
      for (const [key, team] of maps.fullNames.entries()) {
        if (key.startsWith(fullKey)) return { team, matchType: 'city_alias' };
      }
    }
  }

  // 0b. Check Kalshi abbreviation aliases (handles "Los Angeles D", "Ohio St.", etc.)
  const aliases = KALSHI_ALIASES[league] || {};
  const aliasSorted = Object.entries(aliases).sort((a, b) => b[0].length - a[0].length);
  for (const [alias, mascot] of aliasSorted) {
    if (titleLower.includes(alias)) {
      const team = maps.mascots.get(mascot.toLowerCase());
      if (team) return { team, matchType: 'alias' };
      return { team: null, matchType: 'alias_no_db_team' };
    }
  }

  // 1. Full name match (longest first for accuracy)
  const fullEntries = [...maps.fullNames.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [key, team] of fullEntries) {
    if (titleLower.includes(key)) {
      return { team, matchType: 'full_name' };
    }
  }

  // 2. Mascot/team name match (longest first)
  const mascotEntries = [...maps.mascots.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [key, team] of mascotEntries) {
    if (titleLower.includes(key)) {
      return { team, matchType: 'mascot' };
    }
  }

  // 3. City match (unambiguous only, longest first)
  const cityEntries = [...maps.cities.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [key, team] of cityEntries) {
    if (titleLower.includes(key)) {
      return { team, matchType: 'city' };
    }
  }

  return { team: null, matchType: 'no_match' };
}

// Per-game event tickers encode the start: KXMLBGAME-26JUN121840MIAPIT
// → 2026 Jun 12, 18:40 ET. Crude DST handling (Mar–Oct = EDT).
const TICKER_MONTHS: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};
function parseTickerStart(eventTicker: string): string | null {
  const match = /-(\d{2})([A-Z]{3})(\d{2})(\d{2})(\d{2})/.exec(eventTicker || '');
  if (!match) return null;
  const mon = TICKER_MONTHS[match[2]];
  if (mon === undefined) return null;
  const etOffset = mon >= 2 && mon <= 9 ? 4 : 5;
  return new Date(
    Date.UTC(2000 + +match[1], mon, +match[3], +match[4] + etOffset, +match[5]),
  ).toISOString();
}

async function fetchKalshiMarkets(seriesTicker: string) {
  try {
    const url = `${KALSHI_BASE}/markets?series_ticker=${seriesTicker}&status=open&limit=200`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      console.error(`Kalshi API error for ${seriesTicker}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.markets || [];
  } catch (err) {
    console.error(`Error fetching Kalshi markets for ${seriesTicker}:`, err);
    return [];
  }
}

async function fetchResolvedMarkets() {
  try {
    const url = `${KALSHI_BASE}/markets?status=settled&limit=100`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) return [];
    const data = await response.json();
    return data.markets || [];
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch all active teams for matching
    const { data: teams } = await supabase
      .from('teams')
      .select('id, name, city, league')
      .eq('status', 'active');

    const leagueMaps = buildLeagueTeamMaps((teams || []) as TeamRecord[]);

    let totalUpserted = 0;
    let totalSettled = 0;
    let totalSkipped = 0;
    const matchLog: Array<{ ticker: string; title: string; league: string; matchType: string; matchedTeam: string | null }> = [];

    // Sync markets closing within the next 7 days so the Teams feed can show
    // upcoming game markets (was 48h which was too aggressive — most games
    // are scheduled 2-7 days out).
    const now = new Date();
    const cutoff48h = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Fetch open markets for each sport
    for (const [_league, seriesTickers] of Object.entries(SPORT_SERIES)) {
      for (const seriesTicker of seriesTickers) {
        const league = TICKER_TO_LEAGUE[seriesTicker];
        const markets = await fetchKalshiMarkets(seriesTicker);

        for (const m of markets) {
          // Skip markets closing beyond 48 hours from now
          const closeTime = m.close_time || m.expiration_time;
          if (closeTime && new Date(closeTime).getTime() > cutoff48h.getTime()) {
            totalSkipped++;
            continue;
          }
          const title = m.title || m.subtitle || '';
          // Per-game series ("…GAME") list one market PER SIDE: the event
          // title names both teams, and yes_sub_title carries the side
          // (e.g. "Detroit"). Match the team and word the question from the
          // SIDE — matching on the event title picks an arbitrary team and
          // produced identical "X vs Y Winner?" cards for both markets.
          const isGameSeries = seriesTicker.endsWith('GAME');
          const side: string = (m.yes_sub_title || '').trim();

          // A total describes the whole game, not one side — its yes_sub_title
          // is "Over 8.5 runs scored" and names no team at all. Match on the
          // TITLE ("Milwaukee vs San Diego Total Runs?"), which names both,
          // and post the card into both teams' rooms.
          const isGameLevel = GAME_LEVEL_SERIES.has(seriesTicker);
          const { team, matchType } = matchTeam(
            isGameSeries && side ? side : title,
            league,
            leagueMaps,
          );

          // For a game-level market, find the SECOND team too. matchTeam stops
          // at the first hit, so re-run it on the title with the first team's
          // names stripped out.
          let team2: TeamRecord | null = null;
          if (isGameLevel && team) {
            const stripped = title
              .replace(new RegExp(team.city, 'ig'), ' ')
              .replace(new RegExp(team.name, 'ig'), ' ');
            const r2 = matchTeam(stripped, league, leagueMaps);
            if (r2.team && r2.team.id !== team.id) team2 = r2.team;
          }

          matchLog.push({
            ticker: m.ticker,
            title,
            league,
            matchType,
            matchedTeam: team ? `${team.city} ${team.name}` : null,
          });

          // Market type comes from the SERIES, which is unambiguous. The old
          // keyword sniff read the title, and "San Diego wins by over 3.5
          // runs?" contains "win", so every spread was filed as a winner and
          // never became fadeable. Keyword sniff stays as a fallback for
          // series we haven't mapped.
          const titleLower = title.toLowerCase();
          let marketType = SERIES_MARKET_TYPE[seriesTicker] ?? 'other';
          if (marketType === 'other') {
            if (titleLower.includes('spread') || titleLower.includes('cover')) marketType = 'spread';
            else if (titleLower.includes('total') || titleLower.includes('over') || titleLower.includes('under')) marketType = 'total';
            else if (titleLower.includes('win') || titleLower.includes('winner') || titleLower.includes('moneyline')) marketType = 'winner';
            else if (titleLower.includes('points') || titleLower.includes('rebounds') || titleLower.includes('assists')) marketType = 'player_prop';
          }

          // Kalshi puts the line in floor_strike ("Over 8.5 runs scored" ->
          // 8.5). fade-post-props reads metadata.line, and without it a
          // spread or total renders no card at all.
          const strike = typeof m.floor_strike === 'number'
            ? m.floor_strike
            : (typeof m.cap_strike === 'number' ? m.cap_strike : null);

          // Fair price = midpoint of the YES ask/bid (what a market maker
          // would quote). last_price is exactly 0.50 for untraded games,
          // which made every upcoming market look like a fake 50/50 coin
          // flip. The ask/bid midpoint reflects real implied odds and is
          // almost never a flat 50.
          const num = (s: unknown, n: unknown): number | undefined => {
            if (typeof s === 'string' && parseFloat(s) > 0) return parseFloat(s) * 100;
            if (typeof n === 'number' && n > 0) return n;
            return undefined;
          };
          const ask = num(m.yes_ask_dollars, m.yes_ask);
          const bid = num(m.yes_bid_dollars, m.yes_bid);
          const last = num(m.last_price_dollars, m.last_price);
          let cents: number | undefined;
          if (ask !== undefined && bid !== undefined) cents = (ask + bid) / 2;
          else cents = ask ?? bid ?? last;
          const yesPrice = Math.max(1, Math.min(99, Math.round(cents ?? 50)));

          // Per-side game markets: use the correctly-matched team MASCOT so the
          // card reads cleanly ("Will the Yankees win?") instead of Kalshi's
          // abbreviated "New York Y". Opponent context comes from the room's
          // score bar above. (Pairing both sides for a "X vs Y" card is a
          // future polish — Kalshi abbreviates names in the title, so it can't
          // be parsed reliably from one market alone.)
          // Spreads and totals carry the line in yes_sub_title ("Over 8.5 runs
          // scored", "San Diego wins by over 3.5 runs"); the bare title drops
          // it ("Milwaukee vs San Diego Total Runs?"), which would show a card
          // with no number on it.
          const question = isGameSeries
            ? `Will the ${team ? team.name : side} win?`
            : (strike != null && side ? side : (m.title || m.subtitle || m.ticker));

          // One Kalshi market can produce a row per room for game-level types.
          // kalshi_ticker is the conflict key, so each row needs its own —
          // suffix with the team when we fan out.
          const targets: (TeamRecord | null)[] =
            isGameLevel && team2 ? [team, team2] : [team ?? null];

          for (const tgt of targets) {
          const { error } = await supabase
            .from('kalshi_markets')
            .upsert({
              kalshi_ticker: targets.length > 1 && tgt
                ? `${m.ticker}:${tgt.id.slice(0, 8)}`
                : m.ticker,
              team_id: tgt?.id || null,
              question,
              current_yes_price: yesPrice,
              market_type: marketType,
              // Actual game start parsed from the ticker (close_time is a
              // trading-halt buffer up to 3 days AFTER the game and was
              // making finished games look upcoming).
              event_start_time:
                parseTickerStart(m.event_ticker || m.ticker) ||
                m.expected_expiration_time ||
                m.close_time ||
                m.expiration_time,
              kalshi_event_ticker: m.event_ticker || '',
              metadata: {
                // fade-post-props reads metadata.line to word the over/under
                // buttons; without it a spread or total renders no card.
                line: strike,
                strike_type: m.strike_type ?? null,
                side,
                volume: m.volume,
                open_interest: m.open_interest,
                subtitle: m.subtitle,
                series_ticker: seriesTicker,
                league,
              },
            }, { onConflict: 'kalshi_ticker' });

          if (!error) totalUpserted++;
          else console.error(`Upsert error for ${m.ticker}:`, error.message);
          }
        }
      }
    }

    // Log match summary for debugging
    const matched = matchLog.filter(l => l.matchedTeam);
    const unmatched = matchLog.filter(l => !l.matchedTeam);
    console.log(`Match summary: ${matched.length} matched, ${unmatched.length} unmatched`);
    if (unmatched.length > 0) {
      console.log('Unmatched markets:', unmatched.slice(0, 10).map(u => `${u.league}: "${u.title}"`));
    }

    // Purge legacy per-game rows that still carry the old event-title wording
    // ("… Winner?"). The current wording is "X to beat the Y?" / "Will X win?",
    // neither of which contains "Winner", so only stale rows match.
    const { error: purgeErr } = await supabase
      .from('kalshi_markets')
      .delete()
      .eq('is_resolved', false)
      .like('kalshi_ticker', '%GAME%')
      .ilike('question', '%winner%');
    if (purgeErr) console.error('legacy purge error:', purgeErr.message);

    // Check for resolved markets in our DB
    const { data: unresolvedMarkets } = await supabase
      .from('kalshi_markets')
      .select('id, kalshi_ticker')
      .eq('is_resolved', false)
      .lt('event_start_time', new Date().toISOString());

    if (unresolvedMarkets && unresolvedMarkets.length > 0) {
      const resolvedKalshi = await fetchResolvedMarkets();
      const resolvedMap = new Map(resolvedKalshi.map((m: any) => [m.ticker, m.result]));

      for (const market of unresolvedMarkets) {
        const result = resolvedMap.get(market.kalshi_ticker);
        if (result === 'yes' || result === 'no') {
          const resolution = result.toUpperCase();
          const { data: settledCount } = await supabase.rpc('settle_shadow_bets', {
            p_market_id: market.id,
            p_resolution: resolution,
          });
          if (settledCount) totalSettled += settledCount;
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      markets_upserted: totalUpserted,
      markets_skipped_beyond_48h: totalSkipped,
      bets_settled: totalSettled,
      match_summary: {
        total: matchLog.length,
        matched: matchLog.filter(l => l.matchedTeam).length,
        unmatched: matchLog.filter(l => !l.matchedTeam).length,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('kalshi-sync-markets error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
