import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Sport key mappings
const SPORT_KEYS: Record<string, string> = {
  'ncaab': 'basketball_ncaab',
  'ncaaf': 'americanfootball_ncaaf',
  'nfl': 'americanfootball_nfl',
  'nba': 'basketball_nba',
};

// Team name aliases for better matching
const TEAM_ALIASES: Record<string, string[]> = {
  'north carolina': ['unc', 'tar heels', 'tarheels', 'carolina', 'north carolina tar heels'],
  'duke': ['blue devils', 'duke blue devils'],
  'kentucky': ['wildcats', 'kentucky wildcats', 'uk'],
  'kansas': ['jayhawks', 'kansas jayhawks', 'ku'],
  'alabama': ['crimson tide', 'bama', 'tide', 'alabama crimson tide', 'roll tide'],
  'georgia': ['bulldogs', 'georgia bulldogs', 'uga', 'dawgs'],
  'ohio state': ['buckeyes', 'ohio state buckeyes', 'osu'],
  'michigan': ['wolverines', 'michigan wolverines', 'um'],
  'texas': ['longhorns', 'texas longhorns', 'ut'],
  'notre dame': ['fighting irish', 'irish', 'notre dame fighting irish', 'nd'],
  'clemson': ['tigers', 'clemson tigers'],
  'florida': ['gators', 'florida gators', 'uf'],
  'lsu': ['tigers', 'louisiana state', 'lsu tigers'],
  'auburn': ['tigers', 'auburn tigers', 'war eagle'],
  'tennessee': ['volunteers', 'vols', 'tennessee volunteers'],
  'oklahoma': ['sooners', 'oklahoma sooners', 'ou'],
  'oregon': ['ducks', 'oregon ducks', 'uo'],
  'penn state': ['nittany lions', 'psu', 'penn state nittany lions'],
  'usc': ['trojans', 'southern california', 'usc trojans'],
  'ucla': ['bruins', 'ucla bruins'],
  'arizona': ['wildcats', 'arizona wildcats'],
  'gonzaga': ['bulldogs', 'gonzaga bulldogs', 'zags'],
  'villanova': ['wildcats', 'villanova wildcats', 'nova'],
  'uconn': ['huskies', 'connecticut', 'uconn huskies'],
  'houston': ['cougars', 'houston cougars', 'uh'],
  'purdue': ['boilermakers', 'purdue boilermakers'],
  'iowa': ['hawkeyes', 'iowa hawkeyes'],
  'indiana': ['hoosiers', 'indiana hoosiers', 'iu'],
  'wisconsin': ['badgers', 'wisconsin badgers'],
  'illinois': ['fighting illini', 'illini', 'illinois fighting illini'],
  'arkansas': ['razorbacks', 'hogs', 'arkansas razorbacks'],
  'mississippi state': ['bulldogs', 'miss state', 'msu'],
  'ole miss': ['rebels', 'mississippi', 'ole miss rebels'],
  'south carolina': ['gamecocks', 'south carolina gamecocks', 'usc'],
  'virginia': ['cavaliers', 'virginia cavaliers', 'uva', 'wahoos'],
  'virginia tech': ['hokies', 'virginia tech hokies', 'vt'],
  'nc state': ['wolfpack', 'north carolina state', 'nc state wolfpack'],
  'wake forest': ['demon deacons', 'wake forest demon deacons', 'wake'],
  'louisville': ['cardinals', 'louisville cardinals'],
  'syracuse': ['orange', 'syracuse orange', 'cuse'],
  'pittsburgh': ['panthers', 'pittsburgh panthers', 'pitt'],
  'miami': ['hurricanes', 'miami hurricanes', 'the u'],
  'florida state': ['seminoles', 'florida state seminoles', 'fsu', 'noles'],
  'baylor': ['bears', 'baylor bears'],
  'tcu': ['horned frogs', 'texas christian', 'tcu horned frogs'],
  'kansas state': ['wildcats', 'kansas state wildcats', 'k-state', 'ksu'],
  'iowa state': ['cyclones', 'iowa state cyclones'],
  'colorado': ['buffaloes', 'colorado buffaloes', 'buffs', 'cu'],
  'utah': ['utes', 'utah utes'],
  'arizona state': ['sun devils', 'arizona state sun devils', 'asu'],
  'stanford': ['cardinal', 'stanford cardinal'],
  'california': ['golden bears', 'cal', 'california golden bears', 'cal bears'],
  'washington': ['huskies', 'washington huskies', 'uw'],
  'washington state': ['cougars', 'washington state cougars', 'wsu', 'wazzu'],
  'boise state': ['broncos', 'boise state broncos'],
  'memphis': ['tigers', 'memphis tigers'],
  'cincinnati': ['bearcats', 'cincinnati bearcats', 'uc'],
  'smu': ['mustangs', 'southern methodist', 'smu mustangs'],
  'tulane': ['green wave', 'tulane green wave'],
  // NFL Teams
  'chiefs': ['kansas city chiefs', 'kansas city', 'kc chiefs'],
  'bills': ['buffalo bills', 'buffalo'],
  'dolphins': ['miami dolphins'],
  'patriots': ['new england patriots', 'new england', 'pats'],
  'jets': ['new york jets', 'ny jets'],
  'ravens': ['baltimore ravens', 'baltimore'],
  'bengals': ['cincinnati bengals'],
  'browns': ['cleveland browns', 'cleveland'],
  'steelers': ['pittsburgh steelers'],
  'texans': ['houston texans'],
  'colts': ['indianapolis colts', 'indianapolis', 'indy'],
  'jaguars': ['jacksonville jaguars', 'jacksonville', 'jags'],
  'titans': ['tennessee titans'],
  'broncos': ['denver broncos', 'denver'],
  'chargers': ['los angeles chargers', 'la chargers'],
  'raiders': ['las vegas raiders', 'las vegas', 'lv raiders'],
  'cowboys': ['dallas cowboys', 'dallas', 'america\'s team'],
  'eagles': ['philadelphia eagles', 'philadelphia', 'philly'],
  'giants': ['new york giants', 'ny giants'],
  'commanders': ['washington commanders', 'washington'],
  'bears': ['chicago bears', 'chicago', 'da bears'],
  'lions': ['detroit lions', 'detroit'],
  'packers': ['green bay packers', 'green bay', 'gb packers'],
  'vikings': ['minnesota vikings', 'minnesota'],
  'falcons': ['atlanta falcons', 'atlanta', 'atl'],
  'panthers': ['carolina panthers', 'carolina'],
  'saints': ['new orleans saints', 'new orleans', 'nola'],
  'buccaneers': ['tampa bay buccaneers', 'tampa bay', 'tb', 'bucs'],
  'cardinals': ['arizona cardinals'],
  'rams': ['los angeles rams', 'la rams'],
  '49ers': ['san francisco 49ers', 'san francisco', 'sf', 'niners'],
  'seahawks': ['seattle seahawks', 'seattle'],
};

// Find matching team name in API data
function findMatchingTeam(searchTerm: string, apiTeamName: string): boolean {
  const searchLower = searchTerm.toLowerCase().trim();
  const apiLower = apiTeamName.toLowerCase();
  
  // Direct match
  if (apiLower.includes(searchLower) || searchLower.includes(apiLower)) {
    return true;
  }
  
  // Check aliases
  for (const [canonical, aliases] of Object.entries(TEAM_ALIASES)) {
    const allVariants = [canonical, ...aliases];
    const searchMatches = allVariants.some(v => 
      searchLower.includes(v) || v.includes(searchLower)
    );
    const apiMatches = allVariants.some(v => 
      apiLower.includes(v) || v.includes(apiLower)
    );
    
    if (searchMatches && apiMatches) {
      return true;
    }
  }
  
  return false;
}

// Get sport-specific fallback lines
function getFallbackLines(sport: string) {
  if (sport.includes('basketball')) {
    return { over_under: 145.5, spread: -5.5, team_total: 72.5 };
  } else {
    // Football
    return { over_under: 47.5, spread: -6.5, team_total: 24.5 };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { team, sport = 'ncaab' } = await req.json();
    
    if (!team) {
      return new Response(
        JSON.stringify({ error: 'Team name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('ODDS_API_KEY');
    if (!apiKey) {
      console.error('ODDS_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Odds API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sportKey = SPORT_KEYS[sport] || sport;
    console.log(`Fetching odds for team: ${team}, sport: ${sportKey}`);

    // Fetch odds from The Odds API with 7-day window
    const oddsUrl = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${apiKey}&regions=us&markets=spreads,totals&oddsFormat=decimal&daysFrom=7`;
    
    console.log(`API URL: ${oddsUrl.replace(apiKey, 'REDACTED')}`);
    
    const oddsResponse = await fetch(oddsUrl);
    
    if (!oddsResponse.ok) {
      const errorText = await oddsResponse.text();
      console.error('Odds API error:', oddsResponse.status, errorText);
      
      // Return fallback on API error
      const fallback = getFallbackLines(sportKey);
      return new Response(
        JSON.stringify({ 
          game: null, 
          message: `No upcoming games found for ${team}`,
          fallback
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const games = await oddsResponse.json();
    console.log(`Found ${games.length} total games for ${sportKey}`);

    // Find games involving the specified team using improved matching
    const matchingGames = games.filter((game: any) => 
      findMatchingTeam(team, game.home_team) ||
      findMatchingTeam(team, game.away_team)
    );

    console.log(`Found ${matchingGames.length} matching games for team: ${team}`);

    if (matchingGames.length === 0) {
      console.log(`No games found for team: ${team}`);
      const fallback = getFallbackLines(sportKey);
      return new Response(
        JSON.stringify({ 
          game: null, 
          message: `No upcoming games found for ${team}`,
          fallback
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the next upcoming game (filter for future games only)
    const now = new Date();
    const futureGames = matchingGames.filter((g: any) => new Date(g.commence_time) > now);
    
    if (futureGames.length === 0) {
      console.log(`No future games found for team: ${team}`);
      const fallback = getFallbackLines(sportKey);
      return new Response(
        JSON.stringify({ 
          game: null, 
          message: `No upcoming games found for ${team}`,
          fallback
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const nextGame = futureGames.sort((a: any, b: any) => 
      new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime()
    )[0];

    console.log(`Next game: ${nextGame.home_team} vs ${nextGame.away_team} at ${nextGame.commence_time}`);

    // Extract odds from bookmakers (prefer DraftKings, FanDuel, or average)
    let totals: any = null;
    let spreads: any = null;

    const preferredBooks = ['draftkings', 'fanduel', 'betmgm', 'pointsbetus'];
    
    for (const bookmaker of nextGame.bookmakers || []) {
      if (preferredBooks.includes(bookmaker.key)) {
        for (const market of bookmaker.markets || []) {
          if (market.key === 'totals' && !totals) {
            totals = market.outcomes;
          }
          if (market.key === 'spreads' && !spreads) {
            spreads = market.outcomes;
          }
        }
        if (totals && spreads) break;
      }
    }

    // Fallback to first available bookmaker
    if (!totals || !spreads) {
      for (const bookmaker of nextGame.bookmakers || []) {
        for (const market of bookmaker.markets || []) {
          if (market.key === 'totals' && !totals) {
            totals = market.outcomes;
          }
          if (market.key === 'spreads' && !spreads) {
            spreads = market.outcomes;
          }
        }
        if (totals && spreads) break;
      }
    }

    // Parse the lines with sport-specific defaults
    const fallbackLines = getFallbackLines(sportKey);
    const overUnder = totals?.find((o: any) => o.name === 'Over')?.point || fallbackLines.over_under;
    
    // Determine if huddle team is home or away
    const isHomeTeam = findMatchingTeam(team, nextGame.home_team);
    const huddleTeam = isHomeTeam ? nextGame.home_team : nextGame.away_team;
    
    // Get spread for the huddle's team
    let huddleSpread = fallbackLines.spread;
    if (spreads) {
      // Find the spread outcome for the huddle team
      const teamSpread = spreads.find((s: any) => 
        findMatchingTeam(team, s.name)
      );
      if (teamSpread) {
        huddleSpread = teamSpread.point;
      } else if (!isHomeTeam) {
        huddleSpread = -huddleSpread; // Away team typically gets opposite spread
      }
    }

    // Team total (estimate as half of total +/- spread adjustment)
    const teamTotal = Math.round((overUnder / 2 + (huddleSpread < 0 ? 2 : -2)) * 2) / 2;

    const result = {
      game: {
        id: nextGame.id,
        home_team: nextGame.home_team,
        away_team: nextGame.away_team,
        commence_time: nextGame.commence_time,
        sport_key: nextGame.sport_key,
      },
      huddle_team: huddleTeam,
      is_home_team: isHomeTeam,
      lines: {
        over_under: overUnder,
        spread: huddleSpread,
        team_total: teamTotal,
      },
      fade_options: [
        {
          type: 'over',
          label: `Over ${overUnder} points`,
          line_value: overUnder,
          description: `Total game points Over ${overUnder}`,
        },
        {
          type: 'under',
          label: `Under ${overUnder} points`,
          line_value: overUnder,
          description: `Total game points Under ${overUnder}`,
        },
        {
          type: 'spread',
          label: `${huddleTeam} ${huddleSpread > 0 ? '+' : ''}${huddleSpread}`,
          line_value: huddleSpread,
          description: `${huddleTeam} covers the spread (${huddleSpread > 0 ? '+' : ''}${huddleSpread})`,
        },
        {
          type: 'team_total',
          label: `${huddleTeam} Over ${teamTotal}`,
          line_value: teamTotal,
          description: `${huddleTeam} scores Over ${teamTotal} points`,
        },
      ],
    };

    console.log('Returning odds data:', JSON.stringify(result, null, 2));

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fades-get-odds:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});