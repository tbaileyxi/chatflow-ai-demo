import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHighlightlyClient } from "../_shared/highlightly-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const highlightly = createHighlightlyClient();

    const { league, season_year, week_number } = await req.json();

    if (!league || !season_year || !week_number) {
      throw new Error("Missing required parameters: league, season_year, week_number");
    }

    console.log(`Syncing ${league} week ${week_number} for ${season_year}`);

    // Convert league format
    const highlightlyLeague = league === "nfl" ? "NFL" : "NCAA";

    // Fetch matches from Highlightly
    const matches = await highlightly.getMatches({
      league: highlightlyLeague,
      week: week_number,
      season: season_year,
    });

    if (!matches || matches.length === 0) {
      return new Response(
        JSON.stringify({
          message: "No games found for this week",
          processed: 0,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Calculate week start/end based on games
    const gameDates = matches.map((m: any) => new Date(m.startTime));
    const weekStart = new Date(Math.min(...gameDates.map((d) => d.getTime())));
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(Math.max(...gameDates.map((d) => d.getTime())));
    weekEnd.setHours(23, 59, 59, 999);

    // Create or update week
    const { data: weekData, error: weekError } = await supabase
      .from("pickem_weeks")
      .upsert(
        {
          league,
          season_year,
          week_number,
          start_at: weekStart.toISOString(),
          end_at: weekEnd.toISOString(),
        },
        {
          onConflict: "league,season_year,week_number",
          ignoreDuplicates: false,
        }
      )
      .select()
      .single();

    if (weekError) throw weekError;

    // Process games
    let processedGames = 0;
    for (const match of matches) {
      let status = "scheduled";
      if (match.status === "in_progress") {
        status = "in_progress";
      } else if (match.status === "finished") {
        status = "final";
      }

      // Determine winner if game is final
      let winningTeam = null;
      if (status === "final") {
        if (match.homeTeam.score > match.awayTeam.score) {
          winningTeam = match.homeTeam.name;
        } else if (match.awayTeam.score > match.homeTeam.score) {
          winningTeam = match.awayTeam.name;
        }
      }

      const { error: gameError } = await supabase.from("pickem_games").upsert(
        {
          week_id: weekData.id,
          espn_game_id: match.id.toString(),
          match_id: match.id.toString(),
          home_team: match.homeTeam.name,
          away_team: match.awayTeam.name,
          start_time: new Date(match.startTime).toISOString(),
          status,
          winning_team: winningTeam,
        },
        {
          onConflict: "week_id,espn_game_id",
          ignoreDuplicates: false,
        }
      );

      if (gameError) {
        console.error("Error upserting game:", gameError);
        continue;
      }

      processedGames++;
    }

    return new Response(
      JSON.stringify({
        message: `Successfully synced ${league} week ${week_number}`,
        processed: processedGames,
        week_id: weekData.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in pickem-sync:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
