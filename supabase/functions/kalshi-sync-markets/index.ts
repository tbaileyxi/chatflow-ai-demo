import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const KALSHI_BASE = 'https://api.elections.kalshi.com/trade-api/v2';

// Series tickers for sports markets on Kalshi
const SPORT_SERIES: Record<string, string[]> = {
  NBA: ['KXNBA'],
  NFL: ['KXNFL'],
  NHL: ['KXNHL'],
  NCAA: ['KXNCAAB', 'KXNCAAF'],
  MLB: ['KXMLB'],
};

// Map series ticker -> our DB league value
const TICKER_TO_LEAGUE: Record<string, string> = {
  KXNBA: 'NBA',
  KXNFL: 'NFL',
  KXNHL: 'NHL',
  KXNCAAB: 'NCAA',
  KXNCAAF: 'NCAA',
  KXMLB: 'MLB',
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
    'miami (fl)': 'Hurricanes',   // Not in our DB but alias anyway
    'miami (oh)': 'RedHawks',     // Not in our DB
    'ole miss': 'Rebels',         // Not in our DB
    'auburn': 'Tigers',           // Maps to Auburn Tigers - not in Power Four
    'lsu': 'Tigers',              // Maps to LSU Tigers - not in Power Four  
    'tennessee': 'Volunteers',    // Not in Power Four DB
    'tulane': 'Green Wave',       // Not in Power Four DB
    'james madison': 'Dukes',     // Not in Power Four DB
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

  // 0. Check Kalshi abbreviation aliases first (handles "Los Angeles D", "Ohio St.", etc.)
  const aliases = KALSHI_ALIASES[league] || {};
  // Sort by alias length descending so longer aliases match first
  const aliasSorted = Object.entries(aliases).sort((a, b) => b[0].length - a[0].length);
  for (const [alias, mascot] of aliasSorted) {
    if (titleLower.includes(alias)) {
      // Find team by mascot name in this league
      const team = maps.mascots.get(mascot.toLowerCase());
      if (team) return { team, matchType: 'alias' };
      // Alias matched but team not in our DB (e.g. non-Power Four NCAA)
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
    const matchLog: Array<{ ticker: string; title: string; league: string; matchType: string; matchedTeam: string | null }> = [];

    // Fetch open markets for each sport
    for (const [_league, seriesTickers] of Object.entries(SPORT_SERIES)) {
      for (const seriesTicker of seriesTickers) {
        const league = TICKER_TO_LEAGUE[seriesTicker];
        const markets = await fetchKalshiMarkets(seriesTicker);

        for (const m of markets) {
          const title = m.title || m.subtitle || '';
          const { team, matchType } = matchTeam(title, league, leagueMaps);

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

          const yesPrice = Math.round((m.yes_ask || m.last_price || 0.5) * 100);

          const { error } = await supabase
            .from('kalshi_markets')
            .upsert({
              kalshi_ticker: m.ticker,
              team_id: team?.id || null,
              question: m.title || m.subtitle || m.ticker,
              current_yes_price: Math.max(1, Math.min(99, yesPrice)),
              market_type: marketType,
              event_start_time: m.close_time || m.expiration_time,
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
