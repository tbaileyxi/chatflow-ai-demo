import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const highlightly = createHighlightlyClient();

    console.log("Fetching active matches...");
    
    // Get today's matches that are in progress or recently finished
    const today = new Date().toISOString().split("T")[0];
    const nflMatches = await highlightly.getMatches({ league: "NFL", date: today });
    const ncaaMatches = await highlightly.getMatches({ league: "NCAA", date: today });
    
    const activeMatches = [...nflMatches, ...ncaaMatches].filter(
      (m) => m.status === "in_progress" || m.status === "finished"
    );

    console.log(`Found ${activeMatches.length} active/finished matches`);

    let highlightsPosted = 0;

    for (const match of activeMatches) {
      try {
        console.log(`Checking highlights for match ${match.id}: ${match.awayTeam.name} @ ${match.homeTeam.name}`);
        
        const highlights = await highlightly.getHighlights(match.id, 10);
        
        for (const highlight of highlights) {
          // Check if already posted
          const { data: existing } = await supabase
            .from("processed_highlights")
            .select("id")
            .eq("highlight_id", highlight.id)
            .single();

          if (existing) {
            console.log(`Highlight ${highlight.id} already posted, skipping`);
            continue;
          }

          // Find teams in database
          const { data: homeTeam } = await supabase
            .from("teams")
            .select("id")
            .eq("highlightly_id", match.homeTeam.id)
            .single();

          const { data: awayTeam } = await supabase
            .from("teams")
            .select("id")
            .eq("highlightly_id", match.awayTeam.id)
            .single();

          const teams = [homeTeam, awayTeam].filter(Boolean);

          for (const team of teams) {
            if (!team) continue;

            // Find all huddles for this team
            const { data: huddles } = await supabase
              .from("huddles")
              .select("id")
              .eq("team_id", team.id);

            if (!huddles || huddles.length === 0) {
              console.log(`No huddles found for team ${team.id}`);
              continue;
            }

            // Get system user for posting
            const { data: systemUser } = await supabase.rpc("get_or_create_system_user");

            // Post highlight to each huddle
            for (const huddle of huddles) {
              const message = `🎥 HIGHLIGHT: ${highlight.title}

${highlight.description}

Q${highlight.period} - ${highlight.clock}`;

              const { error: insertError } = await supabase
                .from("huddle_messages")
                .insert({
                  huddle_id: huddle.id,
                  user_id: systemUser,
                  content: message,
                  message_type: "highlight",
                  embed_code: highlight.embedUrl,
                  is_bot_message: true,
                  embeds: {
                    type: "video",
                    url: highlight.embedUrl,
                    thumbnail: highlight.thumbnailUrl,
                    duration: highlight.duration,
                  },
                });

              if (insertError) {
                console.error(`Error posting highlight to huddle ${huddle.id}:`, insertError);
              } else {
                console.log(`Posted highlight ${highlight.id} to huddle ${huddle.id}`);
                highlightsPosted++;
              }
            }

            // Mark highlight as processed
            await supabase.from("processed_highlights").insert({
              highlight_id: highlight.id,
              match_id: match.id,
              team_id: team.id,
            });
          }
        }
      } catch (error) {
        console.error(`Error processing match ${match.id}:`, error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        matchesChecked: activeMatches.length,
        highlightsPosted,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Highlight fetch error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
