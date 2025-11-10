import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";
import { createHighlightlyClient } from "../_shared/highlightly-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { command, huddleId, userId, teamName } = await req.json();

    console.log(`Sports stats request: ${command} for team: ${teamName || "auto-detect"} from user: ${userId}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const highlightly = createHighlightlyClient();

    let responseMessage = "";
    let finalTeamName = teamName;

    // If no team name provided, try to get huddle's team
    if (!teamName && huddleId) {
      const { data: huddleData } = await supabase
        .from("huddles")
        .select("team:teams(name, highlightly_id)")
        .eq("id", huddleId)
        .single();

      if (huddleData?.team?.name) {
        finalTeamName = huddleData.team.name;
        console.log(`Using huddle team: ${finalTeamName}`);
      }
    }

    // Handle league shortcuts
    if (finalTeamName?.toLowerCase() === "nfl") {
      responseMessage = await getLeagueScoreboard("NFL", highlightly);
    } else if (finalTeamName?.toLowerCase() === "college" || finalTeamName?.toLowerCase() === "ncaa") {
      responseMessage = await getLeagueScoreboard("NCAA", highlightly);
    } else if (command === "/score") {
      responseMessage = await getScoreUpdate(finalTeamName, supabase, highlightly);
    } else if (command === "/stats") {
      responseMessage = await getTeamStats(finalTeamName, supabase, highlightly);
    } else {
      responseMessage = `Unknown command: ${command}. Available commands: /score, /stats`;
    }

    console.log(`Response message: ${responseMessage.substring(0, 100)}...`);

    // Get system user for posting
    const { data: systemUser, error: systemUserError } = await supabase.rpc("get_or_create_system_user");
    if (systemUserError) {
      console.error("Error getting system user:", systemUserError);
      throw systemUserError;
    }

    console.log(`Posting message to huddle ${huddleId} as user ${systemUser}`);

    // Post the response as a bot message in the huddle
    const { error: messageError } = await supabase.from("huddle_messages").insert({
      huddle_id: huddleId,
      user_id: systemUser,
      content: responseMessage,
      is_bot_message: true,
      message_type: "text",
    });

    if (messageError) {
      console.error("Error posting message:", messageError);
      throw messageError;
    }

    console.log("Message posted successfully");

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Sports stats function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function getLeagueScoreboard(league: "NFL" | "NCAA", highlightly: any): Promise<string> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const matches = await highlightly.getMatches({ league, date: today });

    if (matches.length === 0) {
      return `🏈 No ${league} games today.`;
    }

    let scoreboard = `🏈 **${league} Scores Today**\n\n`;

    matches.slice(0, 10).forEach((match: any) => {
      let statusText = "";

      if (match.status === "finished") {
        statusText = "FINAL";
      } else if (match.status === "in_progress") {
        statusText = `Q${match.period} ${match.clock}`;
      } else if (match.status === "scheduled") {
        const gameTime = new Date(match.startTime).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          timeZone: "America/New_York",
        });
        statusText = gameTime + " ET";
      }

      scoreboard += `${match.awayTeam.abbreviation} ${match.awayTeam.score} - ${match.homeTeam.score} ${match.homeTeam.abbreviation} (${statusText})\n`;
    });

    return scoreboard;
  } catch (error) {
    console.error("Error fetching league scoreboard:", error);
    return `🚨 Unable to fetch ${league} scores right now.`;
  }
}

async function getScoreUpdate(teamName: string, supabase: any, highlightly: any): Promise<string> {
  if (!teamName) {
    return `⚽ Please specify a team name. Usage: /score [team name] or just /score if you're in a team huddle.`;
  }

  try {
    // Find team in database
    const { data: team } = await supabase
      .from("teams")
      .select("highlightly_id, name, league")
      .ilike("name", `%${teamName}%`)
      .not("highlightly_id", "is", null)
      .limit(1)
      .single();

    if (!team || !team.highlightly_id) {
      return `🏈 No team found for "${teamName}". Make sure the team name is correct.`;
    }

    // Get today's and yesterday's matches for this team
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    let matches = await highlightly.getMatches({
      league: team.league,
      date: today,
      teamId: team.highlightly_id,
    });

    if (matches.length === 0) {
      matches = await highlightly.getMatches({
        league: team.league,
        date: yesterday,
        teamId: team.highlightly_id,
      });
    }

    if (matches.length === 0) {
      return `🏈 No recent games found for "${team.name}".\n\nTry:\n• /score nfl (for all NFL scores)\n• /score college (for all college scores)`;
    }

    const match = matches[0];
    return formatScoreUpdate(match);
  } catch (error) {
    console.error("Error fetching scores:", error);
    return `🚨 Unable to fetch scores right now. Please try again later.`;
  }
}

async function getTeamStats(teamName: string, supabase: any, highlightly: any): Promise<string> {
  if (!teamName) {
    return `📊 Please specify a team name. Usage: /stats [team name] or just /stats if you're in a team huddle.`;
  }

  try {
    // Find team in database
    const { data: team } = await supabase
      .from("teams")
      .select("highlightly_id, name, league")
      .ilike("name", `%${teamName}%`)
      .not("highlightly_id", "is", null)
      .limit(1)
      .single();

    if (!team || !team.highlightly_id) {
      return `📊 No team found for "${teamName}".`;
    }

    // Get current match
    const today = new Date().toISOString().split("T")[0];
    const matches = await highlightly.getMatches({
      league: team.league,
      date: today,
      teamId: team.highlightly_id,
      status: "in_progress",
    });

    if (matches.length === 0) {
      return `📊 ${team.name} is not currently playing. Check back during game time!`;
    }

    const match = matches[0];
    const matchDetails = await highlightly.getMatch(match.id);

    return formatGameStats(matchDetails, team.league);
  } catch (error) {
    console.error("Error fetching stats:", error);
    return `🚨 Unable to fetch stats right now. Please try again later.`;
  }
}


function formatScoreUpdate(match: any): string {
  let statusText = "";

  if (match.status === "in_progress") {
    statusText = `🔴 LIVE - ${getPeriodText(match.period)} ${match.clock}`;
  } else if (match.status === "finished") {
    statusText = "FINAL";
  } else if (match.status === "scheduled") {
    const gameTime = new Date(match.startTime).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/New_York",
    });
    statusText = `Scheduled - ${gameTime} ET`;
  }

  return (
    `🏈 **Score Update**\n\n` +
    `${match.awayTeam.name}: **${match.awayTeam.score}**\n` +
    `${match.homeTeam.name}: **${match.homeTeam.score}**\n\n` +
    `Status: ${statusText}`
  );
}

function formatGameStats(match: any, league: string): string {
  let statusText = "";

  if (match.status === "in_progress") {
    statusText = `${getPeriodText(match.period)} - ${match.clock}`;
  } else if (match.status === "finished") {
    statusText = "FINAL";
  } else {
    statusText = match.status;
  }

  return (
    `📊 **${league} Game Stats**\n\n` +
    `**${match.awayTeam.name}** vs **${match.homeTeam.name}**\n\n` +
    `Score: ${match.awayTeam.score} - ${match.homeTeam.score}\n` +
    `Status: ${statusText}\n\n` +
    `_Detailed stats available during live games_`
  );
}

function getPeriodText(period: number): string {
  switch (period) {
    case 1:
      return "1st Quarter";
    case 2:
      return "2nd Quarter";
    case 3:
      return "3rd Quarter";
    case 4:
      return "4th Quarter";
    default:
      return `Period ${period}`;
  }
}
