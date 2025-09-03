import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { huddleId, weekOffset = 0 } = await req.json();
    
    if (!huddleId) {
      return new Response(
        JSON.stringify({ error: 'Huddle ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Creating Pick'em for huddle: ${huddleId}, week offset: ${weekOffset}`);

    // Get huddle settings
    const { data: settings, error: settingsError } = await supabase
      .from('huddle_pickem_settings')
      .select('league')
      .eq('huddle_id', huddleId)
      .eq('is_enabled', true)
      .single();

    if (settingsError || !settings) {
      return new Response(
        JSON.stringify({ error: 'Pick\'em not enabled for this huddle' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Standardize league (NCAA -> NCAAF)
    const league = settings.league === 'ncaa' ? 'ncaaf' : settings.league;
    
    // Calculate season year and week
    const now = new Date();
    let seasonYear = now.getFullYear();
    
    // For NCAAF in Jan/Feb, use previous year
    if (league === 'ncaaf' && (now.getMonth() === 0 || now.getMonth() === 1)) {
      seasonYear = seasonYear - 1;
    }

    // Determine current week number
    let currentWeek = 1;
    if (league === 'nfl') {
      const seasonStart = new Date(seasonYear, 8, 1); // September 1st
      currentWeek = Math.max(1, Math.ceil((now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000)));
    } else if (league === 'ncaaf') {
      const seasonStart = new Date(seasonYear, 7, 15); // August 15th
      currentWeek = Math.max(1, Math.ceil((now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000)));
    }

    const targetWeek = Math.max(1, currentWeek + weekOffset);

    console.log(`Syncing ${league} week ${targetWeek} for ${seasonYear}`);

    // Step 1: Sync games from ESPN
    const syncResult = await supabase.functions.invoke('pickem-sync', {
      body: {
        league: league,
        season_year: seasonYear,
        week_number: targetWeek
      }
    });

    if (syncResult.error) {
      console.error('Sync error:', syncResult.error);
      return new Response(
        JSON.stringify({ error: `Failed to sync games: ${syncResult.error.message}` }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Sync completed, now creating Pick\'em instance');

    // Step 2: Create Pick'em instance for this specific huddle and week
    const autocreateResult = await supabase.functions.invoke('pickem-autocreate', {
      body: {
        huddleId: huddleId,
        forceWeek: targetWeek,
        forceLeague: league,
        forceSeasonYear: seasonYear
      }
    });

    if (autocreateResult.error) {
      console.error('Autocreate error:', autocreateResult.error);
      return new Response(
        JSON.stringify({ error: `Failed to create Pick'em: ${autocreateResult.error.message}` }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const result = autocreateResult.data || { created: [], message: 'Pick\'em created successfully' };

    return new Response(
      JSON.stringify({
        success: true,
        message: `Pick'em for ${league.toUpperCase()} Week ${targetWeek} created successfully`,
        syncResult: syncResult.data,
        autocreateResult: result
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in pickem-create-week:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});