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

    // Parse request body for optional huddle filtering
    let requestBody = null
    try {
      if (req.body) {
        requestBody = await req.json()
      }
    } catch (e) {
      // No body or invalid JSON, continue with auto-create for all
    }

    const targetHuddleId = requestBody?.huddleId

    console.log(targetHuddleId ? 
      `Creating Pick'em for specific huddle: ${targetHuddleId}` : 
      'Starting weekly Pick\'em auto-creation for all enabled huddles...')

    // Get huddles with auto-create enabled (optionally filtered)
    let query = supabase
      .from('huddle_pickem_settings')
      .select(`
        *,
        huddles!inner(id, name, owner_id)
      `)
      .eq('is_enabled', true)

    if (targetHuddleId) {
      // For specific huddle, just check if enabled (not necessarily auto_create_weekly)
      query = query.eq('huddle_id', targetHuddleId)
    } else {
      // For auto-create, only huddles with auto_create_weekly enabled
      query = query.eq('auto_create_weekly', true)
    }

    const { data: settings, error: settingsError } = await query

    if (settingsError) throw settingsError
    if (!settings || settings.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No huddles configured for auto Pick\'em creation',
        created: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let created = 0

    for (const setting of settings) {
      try {
        const league = setting.league
        const currentDate = new Date()
        
        // Handle season year logic for college/pro seasons spanning calendar years
        // For Jan/Feb, use previous year for college football which runs Aug-Jan
        let seasonYear = currentDate.getFullYear()
        if (league === 'ncaa' && currentDate.getMonth() <= 1) { // Jan-Feb
          seasonYear = currentDate.getFullYear() - 1
        }
        
        // Get current week for the league based on date range, not year
        const { data: currentWeek } = await supabase
          .from('pickem_weeks')
          .select('*')
          .eq('league', league)
          .lte('start_at', currentDate.toISOString())
          .gte('end_at', currentDate.toISOString())
          .single()

        if (!currentWeek) {
          console.log(`No current week found for ${league} in huddle ${setting.huddles.name}`)
          continue
        }

        // Check if instance already exists for this week
        const { data: existingInstance } = await supabase
          .from('pickem_instances')
          .select('id')
          .eq('huddle_id', setting.huddle_id)
          .eq('week_id', currentWeek.id)
          .single()

        if (existingInstance) {
          console.log(`Pick'em instance already exists for week ${currentWeek.week_number} in huddle ${setting.huddles.name}`)
          continue
        }

        // Get games for this week
        const { data: games } = await supabase
          .from('pickem_games')
          .select('*')
          .eq('week_id', currentWeek.id)
          .eq('status', 'scheduled')
          .order('start_time', { ascending: true })
          .limit(setting.max_games)

        if (!games || games.length === 0) {
          console.log(`No games found for week ${currentWeek.week_number} in ${league}`)
          continue
        }

        // Create the Pick'em instance
        const { data: instance, error: instanceError } = await supabase
          .from('pickem_instances')
          .insert({
            huddle_id: setting.huddle_id,
            week_id: currentWeek.id,
            created_by: setting.huddles.owner_id,
            title: `Week ${currentWeek.week_number} Pick 'Em`,
            status: 'open'
          })
          .select()
          .single()

        if (instanceError) throw instanceError

        // Link games to the instance
        const gameLinks = games.map(game => ({
          instance_id: instance.id,
          game_id: game.id
        }))

        const { error: linksError } = await supabase
          .from('pickem_instance_games')
          .insert(gameLinks)

        if (linksError) throw linksError

        // Get system user for posting the card
        const { data: systemUser } = await supabase.rpc('get_or_create_system_user')

        // Post the Pick'em card in the huddle
        const { error: messageError } = await supabase
          .from('huddle_messages')
          .insert({
            huddle_id: setting.huddle_id,
            user_id: systemUser,
            content: `🏈 Week ${currentWeek.week_number} Pick 'Em is now live! Tap to join and make your picks before games start.`,
            message_type: 'pickem_card',
            is_bot_message: true,
            embed_code: JSON.stringify({
              type: 'pickem_card',
              instanceId: instance.id,
              title: instance.title,
              gameCount: games.length
            })
          })

        if (messageError) throw messageError

        console.log(`Created Pick'em instance for huddle ${setting.huddles.name}, week ${currentWeek.week_number}`)
        created++

      } catch (error) {
        console.error(`Error creating Pick'em for huddle ${setting.huddles?.name}:`, error)
      }
    }

    return new Response(JSON.stringify({
      message: `Weekly Pick'em auto-creation complete`,
      created: created,
      total_checked: settings.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in pickem-autocreate:', error)
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})