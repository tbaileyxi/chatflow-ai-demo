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

    const { huddleId } = await req.json()
    
    if (!huddleId) {
      throw new Error('Huddle ID is required')
    }

    console.log('Restoring NFL Week 1 Pick Em for huddle:', huddleId)

    // First, sync NFL Week 1 2024 data
    const syncResponse = await supabase.functions.invoke('pickem-sync', {
      body: {
        league: 'nfl',
        season_year: 2024,
        week_number: 1
      }
    })

    if (syncResponse.error) {
      console.error('Error syncing Week 1 data:', syncResponse.error)
      throw new Error('Failed to sync NFL Week 1 data')
    }

    // Get the synced Week 1 data
    const { data: week1, error: weekError } = await supabase
      .from('pickem_weeks')
      .select('id')
      .eq('league', 'nfl')
      .eq('season_year', 2024)
      .eq('week_number', 1)
      .single()

    if (weekError) throw weekError

    // Get the games for Week 1
    const { data: games, error: gamesError } = await supabase
      .from('pickem_games')
      .select('id')
      .eq('week_id', week1.id)
      .limit(10) // Limit to 10 games

    if (gamesError) throw gamesError

    // Create a new Pick Em instance for Week 1
    const { data: instance, error: instanceError } = await supabase
      .from('pickem_instances')
      .insert({
        huddle_id: huddleId,
        week_id: week1.id,
        created_by: (await supabase.auth.getUser()).data.user?.id || '00000000-0000-0000-0000-000000000000',
        title: 'NFL Week 1 2024 - Restored',
        status: 'closed' // Mark as closed since Week 1 is over
      })
      .select()
      .single()

    if (instanceError) throw instanceError

    // Link games to the instance
    const gameLinks = games.map(game => ({
      instance_id: instance.id,
      game_id: game.id
    }))

    const { error: linkError } = await supabase
      .from('pickem_instance_games')
      .insert(gameLinks)

    if (linkError) throw linkError

    // Trigger scoring to get final results
    await supabase.functions.invoke('pickem-scoring')

    return new Response(JSON.stringify({
      success: true,
      message: 'NFL Week 1 Pick Em restored successfully',
      instanceId: instance.id,
      gameCount: games.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error restoring Week 1:', error)
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})