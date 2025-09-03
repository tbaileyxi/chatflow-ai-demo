import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Starting Pick\'em season sync and auto-creation...')

    const currentDate = new Date()
    const currentYear = currentDate.getFullYear()
    
    // Determine which leagues and weeks to sync based on current date
    const leagues = ['nfl', 'ncaa']
    const results: any[] = []

    for (const league of leagues) {
      try {
        let seasonYear = currentYear
        // For NCAA in Jan/Feb, use previous year
        if (league === 'ncaa' && currentDate.getMonth() <= 1) {
          seasonYear = currentYear - 1
        }

        // Determine current week number (simplified logic)
        let currentWeek = 1
        if (league === 'nfl') {
          // NFL runs Sept-Feb, weeks 1-18 + playoffs
          const seasonStart = new Date(seasonYear, 8, 1) // Sept 1
          const weeksSinceStart = Math.floor((currentDate.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000))
          currentWeek = Math.max(1, Math.min(18, weeksSinceStart + 1))
        } else {
          // NCAA runs Aug-Jan, weeks 1-15 + playoffs  
          const seasonStart = new Date(seasonYear, 7, 15) // Aug 15
          const weeksSinceStart = Math.floor((currentDate.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000))
          currentWeek = Math.max(1, Math.min(15, weeksSinceStart + 1))
        }

        console.log(`Syncing ${league} season ${seasonYear}, weeks ${currentWeek} and ${currentWeek + 1}`)

        // Sync current week and next week
        for (const weekOffset of [0, 1]) {
          const weekToSync = currentWeek + weekOffset
          
          const syncResponse = await supabase.functions.invoke('pickem-sync', {
            body: {
              league,
              season_year: seasonYear,
              week_number: weekToSync
            }
          })

          if (syncResponse.error) {
            console.error(`Error syncing ${league} week ${weekToSync}:`, syncResponse.error)
          } else {
            console.log(`Successfully synced ${league} week ${weekToSync}`)
            results.push({
              league,
              season_year: seasonYear,
              week_number: weekToSync,
              status: 'synced'
            })
          }
        }
      } catch (error) {
        console.error(`Error processing league ${league}:`, error)
        results.push({
          league,
          error: error.message,
          status: 'error'
        })
      }
    }

    // After syncing, trigger auto-creation
    console.log('Triggering auto-creation after sync...')
    const autocreateResponse = await supabase.functions.invoke('pickem-autocreate')
    
    if (autocreateResponse.error) {
      console.error('Error in auto-creation:', autocreateResponse.error)
    } else {
      console.log('Auto-creation completed:', autocreateResponse.data)
    }

    return new Response(JSON.stringify({
      message: 'Pick\'em season sync and auto-creation complete',
      sync_results: results,
      autocreate_result: autocreateResponse.data || autocreateResponse.error
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in pickem-sync-season:', error)
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})