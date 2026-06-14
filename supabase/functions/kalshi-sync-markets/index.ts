import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const KALSHI_BASE = 'https://api.elections.kalshi.com/trade-api/v2';

// Series tickers for sports markets on Kalshi.
// Include both season/championship series AND per-game series so the feed
// shows day-of and in-game cards (not just Feb 2027 futures).
const SPORT_SERIES: Record<string, string[]> = {
  NBA: ['KXNBA', 'KXNBAGAME'],
  NFL: ['KXNFL', 'KXNFLGAME'],
  NHL: ['KXNHL', 'KXNHLGAME'],
  NCAA: ['KXNCAAB', 'KXNCAAF', 'KXNCAABGAME', 'KXNCAAFGAME'],
  MLB: ['KXMLB', 'KXMLBGAME'],
};

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

    for (const t of roster) {
      const full = `${t.city} ${t.name}`.toLowerCase();
      fullNames.set(full, t);
      mascots.set(t.name.toLowerCase(), t);

      const cityKey = t.city.toLowerCase();
      cityCount.set(cityKey, (cityCount.get(cityKey) || 0) + 1);
      cityMap.set(cityKey, t);
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
          const { team, matchType } = matchTeam(
            isGameSeries && side ? side : title,
            league,
            leagueMaps,
          );

          matchLog.push({
            ticker: m.ticker,
            title,
            league,
            matchType,
            matchedTeam: team ? `${team.city} ${team.name}` : null,
          });

          // Determine market type
          let marketType = 'other';
          const titleLower = title.toLowerCase();
          if (titleLower.includes('spread') || titleLower.includes('cover')) marketType = 'spread';
          else if (titleLower.includes('total') || titleLower.includes('over') || titleLower.includes('under')) marketType = 'total';
          else if (titleLower.includes('win') || titleLower.includes('winner') || titleLower.includes('moneyline')) marketType = 'winner';
          else if (titleLower.includes('points') || titleLower.includes('rebounds') || titleLower.includes('assists')) marketType = 'player_prop';

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

          // Kalshi-faithful wording: per-side game markets read
          // "Will <team> win?" — futures keep their full market title.
          const question = isGameSeries && side
            ? `Will ${side} win?`
            : m.title || m.subtitle || m.ticker;

          const { error } = await supabase
            .from('kalshi_markets')
            .upsert({
              kalshi_ticker: m.ticker,
              team_id: team?.id || null,
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

    // Log match summary for debugging
    const matched = matchLog.filter(l => l.matchedTeam);
    const unmatched = matchLog.filter(l => !l.matchedTeam);
    console.log(`Match summary: ${matched.length} matched, ${unmatched.length} unmatched`);
    if (unmatched.length > 0) {
      console.log('Unmatched markets:', unmatched.slice(0, 10).map(u => `${u.league}: "${u.title}"`));
    }

    // Purge legacy per-game rows from before the per-side rewrite — they
    // carry event-title questions ("X vs Y Winner?") and trading-halt times
    // days after the game, so they show finished games as upcoming.
    const { error: purgeErr } = await supabase
      .from('kalshi_markets')
      .delete()
      .eq('is_resolved', false)
      .like('kalshi_ticker', '%GAME%')
      .not('question', 'like', 'Will %');
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
