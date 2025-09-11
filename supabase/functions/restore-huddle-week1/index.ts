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

    console.log('Restoring NFL Week 1 for huddle:', huddleId)

    // Call the restore-week1-nfl function
    const { data, error } = await supabase.functions.invoke('restore-week1-nfl', {
      body: { huddleId }
    })

    if (error) {
      console.error('Error restoring Week 1:', error)
      throw error
    }

    console.log('Week 1 restoration result:', data)

    return new Response(JSON.stringify({
      success: true,
      message: 'NFL Week 1 data restored successfully',
      data
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in restore-huddle-week1:', error)
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})