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

    console.log("Fetching NFL teams from Highlightly...");
    const nflTeams = await highlightly.getTeams("NFL");
    console.log(`Found ${nflTeams.length} NFL teams`);

    console.log("Fetching NCAA teams from Highlightly...");
    const ncaaTeams = await highlightly.getTeams("NCAA");
    console.log(`Found ${ncaaTeams.length} NCAA teams`);

    // Fetch all teams from database
    const { data: dbTeams, error: fetchError } = await supabase
      .from("teams")
      .select("*");

    if (fetchError) throw fetchError;

    console.log(`Found ${dbTeams.length} teams in database`);

    const allHighlightlyTeams = [...nflTeams, ...ncaaTeams];
    let matched = 0;
    let unmatched = 0;

    // Match teams
    for (const dbTeam of dbTeams) {
      const match = findMatchingTeam(allHighlightlyTeams, dbTeam);
      
      if (match) {
        console.log(`Matched: ${dbTeam.name} → ${match.name} (ID: ${match.id})`);
        
        const { error: updateError } = await supabase
          .from("teams")
          .update({
            highlightly_id: match.id,
            highlightly_display_name: match.name,
          })
          .eq("id", dbTeam.id);

        if (updateError) {
          console.error(`Error updating ${dbTeam.name}:`, updateError);
        } else {
          matched++;
        }
      } else {
        console.log(`No match found for: ${dbTeam.name} (${dbTeam.city})`);
        unmatched++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        matched,
        unmatched,
        total: dbTeams.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Team sync error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function findMatchingTeam(highlightlyTeams: any[], dbTeam: any): any | null {
  const dbName = dbTeam.name.toLowerCase().trim();
  const dbCity = (dbTeam.city || "").toLowerCase().trim();

  // Try exact name match
  let match = highlightlyTeams.find(
    (t) => t.name.toLowerCase() === dbName
  );
  if (match) return match;

  // Try abbreviation match
  if (dbTeam.abbreviation) {
    match = highlightlyTeams.find(
      (t) => t.abbreviation?.toLowerCase() === dbTeam.abbreviation.toLowerCase()
    );
    if (match) return match;
  }

  // Try city + team name match
  if (dbCity) {
    match = highlightlyTeams.find(
      (t) => t.name.toLowerCase().includes(dbCity) && t.name.toLowerCase().includes(dbName)
    );
    if (match) return match;

    // Try just city match for teams like "Chargers" → "Los Angeles Chargers"
    match = highlightlyTeams.find(
      (t) => t.city?.toLowerCase() === dbCity && t.name.toLowerCase().includes(dbName)
    );
    if (match) return match;
  }

  // Try partial name match (for NCAA teams like "Tar Heels" → "North Carolina Tar Heels")
  match = highlightlyTeams.find(
    (t) => t.name.toLowerCase().includes(dbName) || dbName.includes(t.name.toLowerCase())
  );
  if (match) return match;

  return null;
}
