import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'

interface ESPNGame {
  id: string;
  status: {
    type: {
      name: string;
      state: string;
    };
    period: number;
    clock: string;
  };
  competitions: Array<{
    competitors: Array<{
      team: {
        id: string;
        name: string;
        displayName: string;
        abbreviation: string;
        logo: string;
      };
      score: string;
      homeAway: string;
    }>;
  }>;
  season: {
    year: number;
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { command, huddleId, userId, teamName } = await req.json();
    
    console.log(`Sports stats request: ${command} for team: ${teamName || 'auto-detect'} from user: ${userId}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    let responseMessage = '';
    let finalTeamName = teamName;

    // If no team name provided, try to get huddle's team
    if (!teamName && huddleId) {
      const { data: huddleData } = await supabase
        .from('huddles')
        .select('team:teams(name)')
        .eq('id', huddleId)
        .single();
      
      if (huddleData?.team?.name) {
        finalTeamName = huddleData.team.name;
        console.log(`Using huddle team: ${finalTeamName}`);
      }
    }

    // Handle league shortcuts
    if (finalTeamName?.toLowerCase() === 'nfl') {
      responseMessage = await getLeagueScoreboard('nfl', command);
    } else if (finalTeamName?.toLowerCase() === 'college' || finalTeamName?.toLowerCase() === 'ncaa') {
      responseMessage = await getLeagueScoreboard('college-football', command);
    } else if (command === '/score') {
      responseMessage = await getScoreUpdate(finalTeamName);
    } else if (command === '/stats') {
      responseMessage = await getTeamStats(finalTeamName);
    } else {
      responseMessage = `Unknown command: ${command}. Available commands: /score, /stats`;
    }

    console.log(`Response message: ${responseMessage.substring(0, 100)}...`);

    // Get system user for posting
    const { data: systemUser, error: systemUserError } = await supabase.rpc('get_or_create_system_user');
    if (systemUserError) {
      console.error('Error getting system user:', systemUserError);
      throw systemUserError;
    }

    console.log(`Posting message to huddle ${huddleId} as user ${systemUser}`);

    // Post the response as a bot message in the huddle
    const { error: messageError } = await supabase
      .from('huddle_messages')
      .insert({
        huddle_id: huddleId,
        user_id: systemUser,
        content: responseMessage,
        is_bot_message: true,
        message_type: 'text'
      });

    if (messageError) {
      console.error('Error posting message:', messageError);
      throw messageError;
    }

    console.log('Message posted successfully');

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Sports stats function error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function getLeagueScoreboard(league: string, command: string): Promise<string> {
  try {
    const apiUrl = `https://site.api.espn.com/apis/site/v2/sports/football/${league}/scoreboard`;
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      return `🚨 Unable to fetch ${league.toUpperCase()} scores right now.`;
    }

    const data = await response.json();
    const games = data.events || [];
    
    if (games.length === 0) {
      return `🏈 No ${league.toUpperCase()} games today.`;
    }

    const leagueName = league === 'nfl' ? 'NFL' : 'College Football';
    let scoreboard = `🏈 **${leagueName} ${command === '/score' ? 'Scores' : 'Games'} Today**\n\n`;
    
    games.slice(0, 10).forEach((game: any) => {
      const competition = game.competitions[0];
      const competitors = competition.competitors;
      const homeTeam = competitors.find((c: any) => c.homeAway === 'home') || competitors[0];
      const awayTeam = competitors.find((c: any) => c.homeAway === 'away') || competitors[1];
      
      const status = game.status.type.name;
      let statusText = '';
      
      if (status === 'STATUS_FINAL') {
        statusText = 'FINAL';
      } else if (status === 'STATUS_IN_PROGRESS') {
        statusText = `Q${game.status.period} ${game.status.clock}`;
      } else if (status === 'STATUS_HALFTIME') {
        statusText = 'HALFTIME';
      } else if (status === 'STATUS_SCHEDULED') {
        const gameTime = new Date(competition.date).toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          timeZone: 'America/New_York'
        });
        statusText = gameTime + ' ET';
      } else {
        statusText = status.replace('STATUS_', '');
      }
      
      scoreboard += `${awayTeam.team.abbreviation} ${awayTeam.score} - ${homeTeam.score} ${homeTeam.team.abbreviation} (${statusText})\n`;
    });
    
    return scoreboard;
    
  } catch (error) {
    console.error('Error fetching league scoreboard:', error);
    return `🚨 Unable to fetch ${league.toUpperCase()} scores right now.`;
  }
}

async function getScoreUpdate(teamName: string): Promise<string> {
  if (!teamName) {
    return `⚽ Please specify a team name. Usage: /score [team name] or just /score if you're in a team huddle.`;
  }

  console.log(`Looking for scores for team: "${teamName}"`);

  try {
    // Get today's date in ET timezone
    const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }).replace(/-/g, '');
    
    // Try NFL first (today's games with explicit date)
    console.log('Checking NFL games...');
    const nflResponse = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${todayET}`);
    if (nflResponse.ok) {
      const nflData = await nflResponse.json();
      console.log(`Found ${nflData.events?.length || 0} NFL games today`);
      const nflGame = findTeamGame(nflData.events, teamName);
      if (nflGame) {
        console.log('Found NFL game for team');
        return formatScoreUpdate(nflGame, 'NFL');
      }
    }

    // Try yesterday's NFL games if no today games found
    console.log('Checking yesterday\'s NFL games...');
    const nflYesterdayET = new Date();
    nflYesterdayET.setDate(nflYesterdayET.getDate() - 1);
    const nflYesterdayStr = nflYesterdayET.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }).replace(/-/g, '');
    
    const nflYesterdayResponse = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${nflYesterdayStr}`);
    if (nflYesterdayResponse.ok) {
      const nflYesterdayData = await nflYesterdayResponse.json();
      console.log(`Found ${nflYesterdayData.events?.length || 0} NFL games yesterday`);
      const nflYesterdayGame = findTeamGame(nflYesterdayData.events, teamName);
      if (nflYesterdayGame) {
        console.log('Found NFL game from yesterday');
        return formatScoreUpdate(nflYesterdayGame, 'NFL', false, true);
      }
    }

    // Try College Football (today's games with explicit date)
    console.log('Checking College Football games...');
    const cfbResponse = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates=${todayET}`);
    if (cfbResponse.ok) {
      const cfbData = await cfbResponse.json();
      console.log(`Found ${cfbData.events?.length || 0} College Football games today`);
      const cfbGame = findTeamGame(cfbData.events, teamName);
      if (cfbGame) {
        console.log('Found College Football game for team');
        // Check if it's actually a live or recent game vs old game
        const isLiveOrRecent = cfbGame.status.type.name === 'STATUS_IN_PROGRESS' || 
                               cfbGame.status.type.name === 'STATUS_FINAL' ||
                               cfbGame.status.type.name === 'STATUS_HALFTIME';
        return formatScoreUpdate(cfbGame, 'College Football', isLiveOrRecent);
      }
    }

    // Try yesterday's games for college football only if no today games found
    console.log('Checking yesterday\'s College Football games...');
    const cfbYesterdayET = new Date();
    cfbYesterdayET.setDate(cfbYesterdayET.getDate() - 1);
    const cfbYesterdayStr = cfbYesterdayET.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }).replace(/-/g, '');
    
    const cfbYesterdayResponse = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates=${cfbYesterdayStr}`);
    if (cfbYesterdayResponse.ok) {
      const cfbYesterdayData = await cfbYesterdayResponse.json();
      console.log(`Found ${cfbYesterdayData.events?.length || 0} College Football games yesterday`);
      const cfbYesterdayGame = findTeamGame(cfbYesterdayData.events, teamName);
      if (cfbYesterdayGame) {
        console.log('Found College Football game from yesterday');
        return formatScoreUpdate(cfbYesterdayGame, 'College Football', false, true);
      }
    }

    console.log(`No games found for team: "${teamName}"`);
    return `🏈 No recent games found for "${teamName}".\n\nTry:\n• /score nfl (for all NFL scores)\n• /score college (for all college scores)\n• Make sure the team name is correct (e.g., "Notre Dame" instead of "Fighting Irish")`;
    
  } catch (error) {
    console.error('Error fetching scores:', error);
    return `🚨 Unable to fetch scores right now. Please try again later.`;
  }
}

async function getTeamStats(teamName: string): Promise<string> {
  if (!teamName) {
    return `📊 Please specify a team name. Usage: /stats [team name] or just /stats if you're in a team huddle.`;
  }

  try {
    // Try NFL first
    const nflResponse = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard');
    if (nflResponse.ok) {
      const nflData = await nflResponse.json();
      const nflGame = findTeamGame(nflData.events, teamName);
      if (nflGame) {
        return formatGameStats(nflGame, 'NFL');
      }
    }

    // Try College Football
    const cfbResponse = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard');
    if (cfbResponse.ok) {
      const cfbData = await cfbResponse.json();
      const cfbGame = findTeamGame(cfbData.events, teamName);
      if (cfbGame) {
        return formatGameStats(cfbGame, 'College Football');
      }
    }

    return `📊 No current game stats found for "${teamName}". They might not be playing today or the team name might need to be more specific.`;
    
  } catch (error) {
    console.error('Error fetching stats:', error);
    return `🚨 Unable to fetch stats right now. Please try again later.`;
  }
}

function findTeamGame(events: any[], teamName: string): ESPNGame | null {
  for (const event of events) {
    for (const competition of event.competitions) {
      for (const competitor of competition.competitors) {
        const team = competitor.team;
        
        // Special handling for Cleveland Browns
        const isClevelBrownsMatch = (teamName.toLowerCase() === 'browns' || 
                                    teamName.toLowerCase() === 'cleveland') &&
                                   (team.name.toLowerCase().includes('browns') || 
                                    team.location.toLowerCase().includes('cleveland'));
        
        if (
          isClevelBrownsMatch ||
          team.name.toLowerCase().includes(teamName.toLowerCase()) ||
          team.displayName.toLowerCase().includes(teamName.toLowerCase()) ||
          team.abbreviation.toLowerCase() === teamName.toLowerCase() ||
          team.location.toLowerCase().includes(teamName.toLowerCase())
        ) {
          // Restructure to match our interface
          return {
            id: event.id,
            status: event.status,
            competitions: event.competitions,
            season: event.season
          };
        }
      }
    }
  }
  return null;
}

function formatScoreUpdate(game: ESPNGame, league: string, isLiveOrRecent: boolean = true, isYesterday: boolean = false): string {
  const competition = game.competitions[0];
  const competitors = competition.competitors;
  
  const team1 = competitors[0];
  const team2 = competitors[1];
  
  const homeTeam = competitors.find(c => c.homeAway === 'home') || team1;
  const awayTeam = competitors.find(c => c.homeAway === 'away') || team2;

  const statusText = game.status.type.name;
  const period = game.status.period;
  const clock = game.status.clock;
  const displayClock = (game.status as any).displayClock || clock;

  let gameStatus = '';
  if (statusText === 'STATUS_IN_PROGRESS') {
    gameStatus = `🔴 LIVE - ${getPeriodText(period)} ${displayClock}`;
  } else if (statusText === 'STATUS_HALFTIME') {
    gameStatus = '🔴 HALFTIME';
  } else if (statusText === 'STATUS_FINAL') {
    gameStatus = 'FINAL';
  } else if (statusText === 'STATUS_SCHEDULED') {
    const gameTime = new Date(competition.date).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      timeZone: 'America/New_York'
    });
    gameStatus = `Scheduled - ${gameTime} ET`;
  } else if (statusText === 'STATUS_POSTPONED') {
    gameStatus = 'Postponed';
  } else {
    gameStatus = statusText.replace('STATUS_', '');
  }

  let result = `🏈 **${league} Score Update**\n\n` +
               `${awayTeam.team.displayName}: **${awayTeam.score}**\n` +
               `${homeTeam.team.displayName}: **${homeTeam.score}**\n\n` +
               `Status: ${gameStatus}`;

  // Only add yesterday tag if it's actually from yesterday and not live/recent
  if (isYesterday && !isLiveOrRecent) {
    result += '\n\n*(Game from yesterday)*';
  }

  return result;
}

function formatGameStats(game: ESPNGame, league: string): string {
  const competition = game.competitions[0];
  const competitors = competition.competitors;
  
  const team1 = competitors[0];
  const team2 = competitors[1];
  
  const homeTeam = competitors.find(c => c.homeAway === 'home') || team1;
  const awayTeam = competitors.find(c => c.homeAway === 'away') || team2;

  const statusText = game.status.type.name;
  const period = game.status.period;
  const clock = game.status.clock;

  let gameStatus = '';
  if (statusText === 'STATUS_IN_PROGRESS') {
    gameStatus = `${getPeriodText(period)} - ${clock}`;
  } else if (statusText === 'STATUS_HALFTIME') {
    gameStatus = 'HALFTIME';
  } else if (statusText === 'STATUS_FINAL') {
    gameStatus = 'FINAL';
  } else {
    gameStatus = statusText.replace('STATUS_', '');
  }

  return `📊 **${league} Game Stats**\n\n` +
         `**${awayTeam.team.displayName}** vs **${homeTeam.team.displayName}**\n\n` +
         `Score: ${awayTeam.score} - ${homeTeam.score}\n` +
         `Status: ${gameStatus}\n\n` +
         `_More detailed stats coming soon..._`;
}

function getPeriodText(period: number): string {
  switch (period) {
    case 1: return "1st Quarter";
    case 2: return "2nd Quarter"; 
    case 3: return "3rd Quarter";
    case 4: return "4th Quarter";
    default: return `Period ${period}`;
  }
}