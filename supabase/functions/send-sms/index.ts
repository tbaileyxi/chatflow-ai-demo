import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SMSRequest {
  phone_number: string
  verification_code: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { phone_number, verification_code }: SMSRequest = await req.json()
    
    console.log('SMS request received for phone:', phone_number)
    
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN')
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER')

    console.log('Twilio config check:', {
      hasSid: !!twilioAccountSid,
      hasToken: !!twilioAuthToken,
      hasPhone: !!twilioPhoneNumber
    })

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      throw new Error('Twilio credentials not configured')
    }

    const message = `Your Side Huddle verification code is: ${verification_code}`

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(twilioAccountSid + ':' + twilioAuthToken)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: phone_number,
        From: twilioPhoneNumber,
        Body: message,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Twilio API error:', response.status, error)
      throw new Error(`Twilio API error: ${response.status} - ${error}`)
    }

    const result = await response.json()
    console.log('SMS sent successfully:', result.sid)

    return new Response(
      JSON.stringify({ success: true, message_sid: result.sid }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('SMS function error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to send SMS',
        details: error.toString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})