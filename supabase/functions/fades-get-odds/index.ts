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

// FALSE POSITIVE PREFIXES - these prefixes indicate a DIFFERENT school
const FALSE_POSITIVE_PREFIXES = [
  'middle',
  'eastern',
  'western',
  'northern',
  'southern',
  'central',
  'southeast',
  'southwest',
  'northeast',
  'northwest',
];

// FALSE POSITIVE BLOCKS - full phrases that should block matches
// If API name contains these AND search does NOT contain the prefix, block the match
const FALSE_POSITIVE_BLOCKS = [
  'middle tennessee',
  'eastern michigan',
  'western michigan', 
  'central michigan',
  'northern illinois',
  'eastern illinois',
  'western illinois',
  'southern illinois',
  'eastern kentucky',
  'western kentucky',
  'northern kentucky',
  'eastern washington',
  'central florida',  // UCF is different from Florida
  'south florida',    // USF is different from Florida
  'north carolina state', // NC State is different from UNC
  'south carolina state',
  'georgia state',
  'georgia southern',
  'georgia tech',     // Different from Georgia
  'louisiana tech',   // Different from Louisiana/LSU
  'texas tech',       // Different from Texas
  'texas state',
  'texas a&m',        // Different from Texas
  'michigan state',
  'mississippi state',
  'florida state',    // Different from Florida
  'ohio state',       // Different from Ohio (the school)
  'penn state',       // Different from Penn
  'iowa state',
  'kansas state',
  'washington state',
  'arizona state',
  'oregon state',
  'oklahoma state',
  'colorado state',
  'utah state',
  'boise state',
  'fresno state',
  'san diego state',
  'san jose state',
  'ball state',
  'kent state',
  'appalachian state',
];

// CANONICAL TEAM MAPPINGS - exact mapping from our app's team names to API team names
const CANONICAL_TEAMS: Record<string, string[]> = {
  // SEC
  'tennessee': ['tennessee volunteers'],
  'alabama': ['alabama crimson tide'],
  'georgia': ['georgia bulldogs'],
  'florida': ['florida gators'],
  'lsu': ['lsu tigers', 'louisiana state tigers'],
  'auburn': ['auburn tigers'],
  'texas a&m': ['texas a&m aggies'],
  'arkansas': ['arkansas razorbacks'],
  'mississippi state': ['mississippi state bulldogs'],
  'ole miss': ['ole miss rebels', 'mississippi rebels'],
  'south carolina': ['south carolina gamecocks'],
  'kentucky': ['kentucky wildcats'],
  'missouri': ['missouri tigers'],
  'vanderbilt': ['vanderbilt commodores'],
  'oklahoma': ['oklahoma sooners'],
  'texas': ['texas longhorns'],
  
  // Big Ten
  'ohio state': ['ohio state buckeyes'],
  'michigan': ['michigan wolverines'],
  'penn state': ['penn state nittany lions'],
  'iowa': ['iowa hawkeyes'],
  'wisconsin': ['wisconsin badgers'],
  'minnesota': ['minnesota golden gophers'],
  'illinois': ['illinois fighting illini'],
  'northwestern': ['northwestern wildcats'],
  'purdue': ['purdue boilermakers'],
  'indiana': ['indiana hoosiers'],
  'nebraska': ['nebraska cornhuskers'],
  'maryland': ['maryland terrapins'],
  'rutgers': ['rutgers scarlet knights'],
  'michigan state': ['michigan state spartans'],
  'oregon': ['oregon ducks'],
  'washington': ['washington huskies'],
  'usc': ['usc trojans', 'southern california trojans'],
  'ucla': ['ucla bruins'],
  
  // ACC
  'clemson': ['clemson tigers'],
  'florida state': ['florida state seminoles'],
  'miami': ['miami hurricanes'],
  'north carolina': ['north carolina tar heels'],
  'nc state': ['nc state wolfpack', 'north carolina state wolfpack'],
  'duke': ['duke blue devils'],
  'virginia': ['virginia cavaliers'],
  'virginia tech': ['virginia tech hokies'],
  'louisville': ['louisville cardinals'],
  'pittsburgh': ['pittsburgh panthers', 'pitt panthers'],
  'syracuse': ['syracuse orange'],
  'boston college': ['boston college eagles'],
  'wake forest': ['wake forest demon deacons'],
  'georgia tech': ['georgia tech yellow jackets'],
  'stanford': ['stanford cardinal'],
  'california': ['california golden bears', 'cal bears'],
  'smu': ['smu mustangs', 'southern methodist mustangs'],
  
  // Big 12
  'kansas': ['kansas jayhawks'],
  'kansas state': ['kansas state wildcats'],
  'baylor': ['baylor bears'],
  'tcu': ['tcu horned frogs'],
  'iowa state': ['iowa state cyclones'],
  'texas tech': ['texas tech red raiders'],
  'oklahoma state': ['oklahoma state cowboys'],
  'west virginia': ['west virginia mountaineers'],
  'cincinnati': ['cincinnati bearcats'],
  'houston': ['houston cougars'],
  'ucf': ['ucf knights', 'central florida knights'],
  'byu': ['byu cougars', 'brigham young cougars'],
  'colorado': ['colorado buffaloes'],
  'arizona': ['arizona wildcats'],
  'arizona state': ['arizona state sun devils'],
  'utah': ['utah utes'],
  
  // Other notable
  'notre dame': ['notre dame fighting irish'],
  'gonzaga': ['gonzaga bulldogs'],
  'villanova': ['villanova wildcats'],
  'uconn': ['uconn huskies', 'connecticut huskies'],
  'memphis': ['memphis tigers'],
  'tulane': ['tulane green wave'],
  'boise state': ['boise state broncos'],
  
  // NFL Teams
  'chiefs': ['kansas city chiefs'],
  'bills': ['buffalo bills'],
  'dolphins': ['miami dolphins'],
  'patriots': ['new england patriots'],
  'jets': ['new york jets'],
  'ravens': ['baltimore ravens'],
  'bengals': ['cincinnati bengals'],
  'browns': ['cleveland browns'],
  'steelers': ['pittsburgh steelers'],
  'texans': ['houston texans'],
  'colts': ['indianapolis colts'],
  'jaguars': ['jacksonville jaguars'],
  'titans': ['tennessee titans'],
  'broncos': ['denver broncos'],
  'chargers': ['los angeles chargers'],
  'raiders': ['las vegas raiders'],
  'cowboys': ['dallas cowboys'],
  'eagles': ['philadelphia eagles'],
  'giants': ['new york giants'],
  'commanders': ['washington commanders'],
  'bears': ['chicago bears'],
  'lions': ['detroit lions'],
  'packers': ['green bay packers'],
  'vikings': ['minnesota vikings'],
  'falcons': ['atlanta falcons'],
  'panthers': ['carolina panthers'],
  'saints': ['new orleans saints'],
  'buccaneers': ['tampa bay buccaneers'],
  'cardinals': ['arizona cardinals'],
  'rams': ['los angeles rams'],
  '49ers': ['san francisco 49ers'],
  'seahawks': ['seattle seahawks'],
};

// Additional aliases that map to canonical names
const TEAM_ALIASES: Record<string, string> = {
  // Tennessee variations -> tennessee
  'vols': 'tennessee',
  'volunteers': 'tennessee',
  'tennessee vols': 'tennessee',
  'tennessee volunteers': 'tennessee',
  'ut': 'tennessee',
  
  // Alabama variations
  'bama': 'alabama',
  'crimson tide': 'alabama',
  'roll tide': 'alabama',
  
  // Georgia variations
  'dawgs': 'georgia',
  'uga': 'georgia',
  'bulldogs': 'georgia', // Context-dependent, but default to Georgia
  
  // UNC variations
  'unc': 'north carolina',
  'tar heels': 'north carolina',
  'tarheels': 'north carolina',
  'carolina': 'north carolina',
  
  // Michigan variations
  'wolverines': 'michigan',
  'um': 'michigan',
  'go blue': 'michigan',
  
  // Ohio State variations
  'buckeyes': 'ohio state',
  'osu': 'ohio state',
  'the ohio state': 'ohio state',
  
  // Notre Dame variations
  'irish': 'notre dame',
  'fighting irish': 'notre dame',
  'nd': 'notre dame',
  
  // Florida variations
  'gators': 'florida',
  'uf': 'florida',
  
  // LSU variations
  'tigers': 'lsu', // Default context
  'louisiana state': 'lsu',
  'geaux tigers': 'lsu',
  
  // Clemson variations
  'clemson tigers': 'clemson',
  
  // Texas variations
  'longhorns': 'texas',
  'hook em': 'texas',
  
  // Oklahoma variations
  'sooners': 'oklahoma',
  'ou': 'oklahoma',
  'boomer sooner': 'oklahoma',
  
  // Oregon variations
  'ducks': 'oregon',
  'uo': 'oregon',
  
  // USC variations
  'trojans': 'usc',
  'southern california': 'usc',
  'southern cal': 'usc',
  
  // Penn State variations
  'nittany lions': 'penn state',
  'psu': 'penn state',
  
  // Florida State variations
  'seminoles': 'florida state',
  'fsu': 'florida state',
  'noles': 'florida state',
  
  // Miami variations
  'hurricanes': 'miami',
  'the u': 'miami',
  'canes': 'miami',
  
  // Kentucky variations
  'wildcats': 'kentucky', // Default context for basketball
  'uk': 'kentucky',
  'big blue nation': 'kentucky',
  
  // Duke variations
  'blue devils': 'duke',
  
  // Kansas variations
  'jayhawks': 'kansas',
  'ku': 'kansas',
  'rock chalk': 'kansas',
  
  // Gonzaga variations
  'zags': 'gonzaga',
  
  // South Carolina variations
  'gamecocks': 'south carolina',
  'cocks': 'south carolina',
  'uofsc': 'south carolina',
  
  // Auburn variations
  'war eagle': 'auburn',
  
  // Arkansas variations
  'razorbacks': 'arkansas',
  'hogs': 'arkansas',
  'woo pig': 'arkansas',
  
  // Ole Miss variations
  'rebels': 'ole miss',
  'mississippi': 'ole miss',
  'hotty toddy': 'ole miss',
  
  // Virginia variations
  'cavaliers': 'virginia',
  'uva': 'virginia',
  'wahoos': 'virginia',
  'hoos': 'virginia',
};

// Find matching team name in API data with strict false positive prevention
function findMatchingTeam(searchTerm: string, apiTeamName: string): boolean {
  const searchLower = searchTerm.toLowerCase().trim();
  const apiLower = apiTeamName.toLowerCase().trim();
  
  console.log(`  Checking: "${searchLower}" vs API: "${apiLower}"`);
  
  // Step 1: Resolve search term to canonical name
  let canonicalSearch = searchLower;
  
  // Check if search term IS a canonical name
  if (CANONICAL_TEAMS[searchLower]) {
    canonicalSearch = searchLower;
  } 
  // Check if search term is an alias
  else if (TEAM_ALIASES[searchLower]) {
    canonicalSearch = TEAM_ALIASES[searchLower];
  }
  // Try partial matching on canonical names
  else {
    for (const canonical of Object.keys(CANONICAL_TEAMS)) {
      if (canonical.includes(searchLower) || searchLower.includes(canonical)) {
        canonicalSearch = canonical;
        break;
      }
    }
  }
  
  console.log(`  Canonical search: "${canonicalSearch}"`);
  
  // Step 2: FALSE POSITIVE BLOCK CHECK (CRITICAL)
  // If API team contains a blocking phrase but search doesn't include the prefix, BLOCK
  for (const block of FALSE_POSITIVE_BLOCKS) {
    if (apiLower.includes(block)) {
      const blockPrefix = block.split(' ')[0]; // e.g., 'middle' from 'middle tennessee'
      
      // If search term doesn't explicitly include the blocking prefix, reject
      if (!searchLower.includes(blockPrefix) && !canonicalSearch.includes(blockPrefix)) {
        console.log(`  ❌ BLOCKED: API contains "${block}" but search doesn't include "${blockPrefix}"`);
        return false;
      }
    }
  }
  
  // Step 3: Check for false positive prefixes in API name
  for (const prefix of FALSE_POSITIVE_PREFIXES) {
    // Check if API name STARTS with a false positive prefix
    if (apiLower.startsWith(prefix + ' ')) {
      // Only allow if search explicitly includes that prefix
      if (!searchLower.startsWith(prefix) && !canonicalSearch.startsWith(prefix)) {
        console.log(`  ❌ BLOCKED: API starts with prefix "${prefix}" but search doesn't`);
        return false;
      }
    }
  }
  
  // Step 4: Get expected API names for the canonical team
  const expectedApiNames = CANONICAL_TEAMS[canonicalSearch];
  
  if (expectedApiNames) {
    // Check if API team name matches any expected name
    for (const expected of expectedApiNames) {
      if (apiLower === expected || apiLower.includes(expected) || expected.includes(apiLower)) {
        console.log(`  ✅ MATCH via canonical: "${expected}"`);
        return true;
      }
      
      // Also check word-by-word matching
      const expectedWords = expected.split(/\s+/);
      const apiWords = apiLower.split(/\s+/);
      
      // All expected words should be in API name
      const allWordsMatch = expectedWords.every(ew => 
        apiWords.some(aw => aw === ew || aw.includes(ew) || ew.includes(aw))
      );
      
      if (allWordsMatch) {
        console.log(`  ✅ MATCH via word matching: "${expected}"`);
        return true;
      }
    }
  }
  
  // Step 5: Fallback - direct exact match only (very strict)
  if (apiLower === searchLower || apiLower === canonicalSearch) {
    console.log(`  ✅ MATCH via exact match`);
    return true;
  }
  
  console.log(`  ❌ NO MATCH`);
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
    console.log(`🔍 Fetching odds for team: "${team}", sport: ${sportKey}`);

    // Fetch odds from The Odds API with 7-day window
    const oddsUrl = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${apiKey}&regions=us&markets=spreads,totals&oddsFormat=decimal&daysFrom=7`;
    
    const oddsResponse = await fetch(oddsUrl);
    
    if (!oddsResponse.ok) {
      const errorText = await oddsResponse.text();
      console.error('Odds API error:', oddsResponse.status, errorText);
      
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
    console.log(`📊 Found ${games.length} total games for ${sportKey}`);
    
    // Log all team names for debugging
    if (games.length > 0) {
      console.log('All teams in API response:');
      const uniqueTeams = new Set<string>();
      games.forEach((g: any) => {
        uniqueTeams.add(g.home_team);
        uniqueTeams.add(g.away_team);
      });
      Array.from(uniqueTeams).sort().forEach(t => console.log(`  - ${t}`));
    }

    // Find games involving the specified team using strict matching
    console.log(`\n🎯 Looking for matches for: "${team}"`);
    const matchingGames = games.filter((game: any) => {
      console.log(`\nChecking game: ${game.home_team} vs ${game.away_team}`);
      const homeMatch = findMatchingTeam(team, game.home_team);
      const awayMatch = findMatchingTeam(team, game.away_team);
      return homeMatch || awayMatch;
    });

    console.log(`\n✅ Found ${matchingGames.length} matching games for team: ${team}`);

    if (matchingGames.length === 0) {
      console.log(`❌ No games found for team: ${team}`);
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

    console.log(`🏀 Next game: ${nextGame.home_team} vs ${nextGame.away_team} at ${nextGame.commence_time}`);

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
      const teamSpread = spreads.find((s: any) => 
        findMatchingTeam(team, s.name)
      );
      if (teamSpread) {
        huddleSpread = teamSpread.point;
      } else if (!isHomeTeam) {
        huddleSpread = -huddleSpread;
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

    console.log('📤 Returning odds data for:', result.game.home_team, 'vs', result.game.away_team);

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
