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

    // Fetch odds from The Odds API
    const oddsUrl = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${apiKey}&regions=us&markets=spreads,totals&oddsFormat=decimal`;
    
    const oddsResponse = await fetch(oddsUrl);
    
    if (!oddsResponse.ok) {
      const errorText = await oddsResponse.text();
      console.error('Odds API error:', oddsResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch odds', details: errorText }),
        { status: oddsResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const games = await oddsResponse.json();
    console.log(`Found ${games.length} games`);

    // Find games involving the specified team (case-insensitive partial match)
    const teamLower = team.toLowerCase();
    const matchingGames = games.filter((game: any) => 
      game.home_team.toLowerCase().includes(teamLower) ||
      game.away_team.toLowerCase().includes(teamLower)
    );

    if (matchingGames.length === 0) {
      console.log(`No games found for team: ${team}`);
      return new Response(
        JSON.stringify({ 
          game: null, 
          message: `No upcoming games found for ${team}`,
          fallback: {
            over_under: 140.5,
            spread: -5.5,
            team_total: 72.5
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the next upcoming game
    const nextGame = matchingGames.sort((a: any, b: any) => 
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

    // Parse the lines
    const overUnder = totals?.find((o: any) => o.name === 'Over')?.point || 140.5;
    
    // Determine if huddle team is home or away
    const isHomeTeam = nextGame.home_team.toLowerCase().includes(teamLower);
    const huddleTeam = isHomeTeam ? nextGame.home_team : nextGame.away_team;
    
    // Get spread for the huddle's team
    const huddleSpread = spreads?.find((s: any) => 
      s.name.toLowerCase().includes(teamLower)
    )?.point || (isHomeTeam ? -5.5 : 5.5);

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
