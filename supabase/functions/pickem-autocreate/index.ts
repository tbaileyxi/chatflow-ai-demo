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
        // Allow overrides from request body when triggered manually
        const baseLeague = (requestBody?.forceLeague ?? setting.league) as string
        const league = baseLeague === 'ncaa' ? 'ncaaf' : baseLeague // standardize

        // Determine target week
        let targetWeek: any = null

        if (requestBody?.forceWeek && requestBody?.forceSeasonYear) {
          // Use explicitly forced season/year/week if provided
          const { data: forcedWeek, error: forcedWeekError } = await supabase
            .from('pickem_weeks')
            .select('*')
            .eq('league', league)
            .eq('season_year', requestBody.forceSeasonYear)
            .eq('week_number', requestBody.forceWeek)
            .maybeSingle()
          if (forcedWeekError) throw forcedWeekError
          targetWeek = forcedWeek
          if (!targetWeek) {
            console.log(`No week found for ${league} ${requestBody.forceSeasonYear} week ${requestBody.forceWeek}`)
            continue
          }
        } else {
          // Default behavior: pick the nearest upcoming week; if none, fallback to the current week window
          const nowIso = new Date().toISOString()
          const { data: upcomingWeek, error: upcomingErr } = await supabase
            .from('pickem_weeks')
            .select('*')
            .eq('league', league)
            .gte('start_at', nowIso)
            .order('start_at', { ascending: true })
            .limit(1)
            .maybeSingle()
          if (upcomingErr) throw upcomingErr

          if (upcomingWeek) {
            targetWeek = upcomingWeek
          } else {
            // Fallback to a week that currently includes now (useful during in-progress weeks)
            const { data: currentWeek, error: currentErr } = await supabase
              .from('pickem_weeks')
              .select('*')
              .eq('league', league)
              .lte('start_at', nowIso)
              .gte('end_at', nowIso)
              .maybeSingle()
            if (currentErr) throw currentErr
            targetWeek = currentWeek
          }

          if (!targetWeek) {
            console.log(`No upcoming or current week found for ${league} in huddle ${setting.huddles.name}`)
            continue
          }
        }

        // Check if instance already exists for this huddle + week
        const { data: existingInstance } = await supabase
          .from('pickem_instances')
          .select('id')
          .eq('huddle_id', setting.huddle_id)
          .eq('week_id', targetWeek.id)
          .maybeSingle()
        if (existingInstance) {
          console.log(`Pick'em instance already exists for week ${targetWeek.week_number} in huddle ${setting.huddles.name}`)
          continue
        }

        // Fetch scheduled games and respect max_games cap
        const { data: games, error: gamesErr } = await supabase
          .from('pickem_games')
          .select('*')
          .eq('week_id', targetWeek.id)
          .eq('status', 'scheduled')
          .order('start_time', { ascending: true })
          .limit(setting.max_games ?? 10)
        if (gamesErr) throw gamesErr

        if (!games || games.length === 0) {
          console.log(`No games found for week ${targetWeek.week_number} in ${league}`)
          continue
        }

        // Create the Pick'em instance
        const { data: instance, error: instanceError } = await supabase
          .from('pickem_instances')
          .insert({
            huddle_id: setting.huddle_id,
            week_id: targetWeek.id,
            created_by: setting.huddles.owner_id,
            title: `Week ${targetWeek.week_number} Pick 'Em`,
            status: 'open'
          })
          .select()
          .single()
        if (instanceError) throw instanceError

        // Link games to the instance
        const gameLinks = games.map((game: any) => ({
          instance_id: instance.id,
          game_id: game.id
        }))
        const { error: linksError } = await supabase
          .from('pickem_instance_games')
          .insert(gameLinks)
        if (linksError) throw linksError

        // Post the Pick'em card in the huddle via system user
        const { data: systemUser } = await supabase.rpc('get_or_create_system_user')
        const { error: messageError } = await supabase
          .from('huddle_messages')
          .insert({
            huddle_id: setting.huddle_id,
            user_id: systemUser,
            content: `🏈 Week ${targetWeek.week_number} Pick 'Em is now live! Tap to join and make your picks before games start.`,
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

        console.log(`Created Pick'em instance for huddle ${setting.huddles.name}, week ${targetWeek.week_number}`)
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