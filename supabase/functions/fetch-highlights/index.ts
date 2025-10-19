import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHighlightlyClient } from "../_shared/highlightly-client.ts";
import { isNFLGameTime, isNCAAGameTime } from "../_shared/game-schedule.ts";

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

    console.log("🎥 Fetching highlights for active and recently finished matches...");
    
    const today = new Date().toISOString().split("T")[0];
    const allMatches = [];
    
    // Only fetch NFL if game time (with error handling)
    if (isNFLGameTime()) {
      try {
        const nflMatches = await highlightly.getMatches({
          league: "NFL",
          date: today,
        });
        
        if (nflMatches && Array.isArray(nflMatches)) {
          allMatches.push(...nflMatches);
          console.log(`🎥 Found ${nflMatches.length} NFL matches`);
        } else {
          console.warn("⚠️ NFL API returned invalid data");
        }
      } catch (error) {
        console.error("❌ Error fetching NFL highlights:", error);
        // Continue to NCAA instead of crashing
      }
    } else {
      console.log("🎥 Skipping NFL - outside game window");
    }
    
    // Only fetch NCAA if game time (with error handling)
    if (isNCAAGameTime()) {
      try {
        const ncaaMatches = await highlightly.getMatches({
          league: "NCAA",
          date: today,
        });
        
        if (ncaaMatches && Array.isArray(ncaaMatches)) {
          allMatches.push(...ncaaMatches);
          console.log(`🎥 Found ${ncaaMatches.length} NCAA matches`);
        } else {
          console.warn("⚠️ NCAA API returned invalid data");
        }
      } catch (error) {
        console.error("❌ Error fetching NCAA highlights:", error);
        // Continue processing what we have
      }
    } else {
      console.log("🎥 Skipping NCAA - outside game window");
    }
    
    // Filter to recent games only (within 3 hours of finish)
    const threeHoursAgo = Date.now() - (3 * 60 * 60 * 1000);
    const activeMatches = allMatches.filter(m => {
      if (m.status === 'in_progress') return true;
      if (m.status === 'finished') {
        const finishTime = new Date(m.date).getTime();
        return finishTime > threeHoursAgo;
      }
      return false;
    });

    console.log(`Found ${activeMatches.length} active/recent matches to check`);

    let highlightsPosted = 0;
    
    // Process max 10 games per run to stay within API limits
    const matchesToProcess = activeMatches.slice(0, 10);

    for (const match of matchesToProcess) {
      try {
        console.log(`🎥 Checking highlights for match ${match.id}: ${match.awayTeam.name} @ ${match.homeTeam.name}`);
        
        const highlights = await highlightly.getHighlights(match.id, 10);
        
        if (!highlights || !Array.isArray(highlights)) {
          console.warn(`⚠️ No highlights returned for match ${match.id}`);
          continue;
        }
        
        console.log(`🎥 Found ${highlights.length} highlights for match ${match.id}`);
        
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

            // DUAL POSTING: Post to huddles AND Spotlight
            
            // 1. Post to each team huddle
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
                console.error(`❌ Error posting highlight to huddle ${huddle.id}:`, insertError);
              } else {
                console.log(`✅ Posted highlight ${highlight.id} to huddle ${huddle.id}`);
                highlightsPosted++;
              }
            }
            
            // 2. Post to Spotlight (Bot's Blitz Board)
            const { error: spotlightError } = await supabase
              .from("posts")
              .insert({
                content: `🎥 ${highlight.title}\n\n${highlight.description || ''}\n\nQ${highlight.period} - ${highlight.clock}`,
                author_id: systemUser,
                team_id: team.id,
                origin_team_id: team.id,
                is_spotlight: true,
                is_agent_post: true,
                target_audience: ['spotlight'],
                message_type: 'highlight',
                embeds: {
                  type: 'video',
                  url: highlight.embedUrl,
                  thumbnail: highlight.thumbnailUrl || null,
                  title: highlight.title,
                  description: highlight.description || null,
                  duration: highlight.duration || null,
                  period: highlight.period,
                  clock: highlight.clock
                },
                embed_code: highlight.embedUrl
              });
            
            if (spotlightError) {
              console.error("❌ Error posting highlight to Spotlight:", spotlightError);
            } else {
              console.log(`✅ Posted highlight ${highlight.id} to Spotlight for team ${team.id}`);
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
        console.error(`❌ Error processing match ${match.id}:`, error.message || error);
        // Continue processing other matches
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        matchesChecked: matchesToProcess.length,
        totalMatchesFound: activeMatches.length,
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
