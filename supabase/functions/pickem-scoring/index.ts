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

    console.log("Starting pick'em scoring update...");

    // Get all games from recent weeks that might need updates
    const { data: games, error: gamesError } = await supabase
      .from("pickem_games")
      .select(
        `
        *,
        pickem_weeks!inner(*)
      `
      )
      .gte("start_time", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
      .lte("start_time", new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()) // Next 7 days
      .in("status", ["scheduled", "in_progress", "final"]);

    if (gamesError) throw gamesError;
    if (!games || games.length === 0) {
      return new Response(
        JSON.stringify({
          message: "No games to update",
          updated: 0,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let updatedGames = 0;

    // Process each game individually with Highlightly
    for (const game of games) {
      try {
        if (!game.match_id) {
          console.log(`No match_id for game ${game.id}, skipping`);
          continue;
        }

        const matchId = parseInt(game.match_id);
        const match = await highlightly.getMatch(matchId);

        if (!match) {
          console.log(`Match not found for ID ${matchId}`);
          continue;
        }

        let status = "scheduled";
        if (match.status === "in_progress") {
          status = "in_progress";
        } else if (match.status === "finished") {
          status = "final";
        }

        // Prevent future games from being marked as final
        const gameStartTime = new Date(game.start_time);
        const now = new Date();
        const isGameInFuture = gameStartTime > now;

        if (isGameInFuture && status === "final") {
          console.log(`WARNING: Future game ${matchId} marked as final, forcing to scheduled`);
          status = "scheduled";
        }

        // Determine winner if game is final
        let winningTeam = null;
        if (status === "final" && !isGameInFuture) {
          if (match.homeTeam.score > match.awayTeam.score) {
            winningTeam = match.homeTeam.name;
          } else if (match.awayTeam.score > match.homeTeam.score) {
            winningTeam = match.awayTeam.name;
          }
        }

        // Only update if status or winner changed
        if (game.status !== status || game.winning_team !== winningTeam) {
          const { error: updateError } = await supabase
            .from("pickem_games")
            .update({
              status,
              winning_team: winningTeam,
              updated_at: new Date().toISOString(),
            })
            .eq("id", game.id);

          if (updateError) {
            console.error("Error updating game:", updateError);
          } else {
            updatedGames++;
            console.log(`Updated game ${matchId}: ${status}, winner: ${winningTeam}`);
          }
        }
      } catch (error) {
        console.error(`Error processing game ${game.id}:`, error);
      }
    }

    return new Response(
      JSON.stringify({
        message: `Pick'em scoring update complete`,
        updated: updatedGames,
        total_checked: games.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in pickem-scoring:", error);
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
