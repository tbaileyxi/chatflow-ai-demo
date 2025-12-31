import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CoachPromptRequest {
  huddle_id: string;
  team_name: string;
  trigger_type: 'daily' | 'live_game' | 'score_update' | 'game_end' | 'fade_settlement';
  context?: {
    score?: string;
    period?: string;
    event_description?: string;
    fade_winner?: string;
    fade_loser?: string;
    fade_amount?: number;
  };
}

// Coach personality prompts - NEW spec: sharp, trash-talky, punchy (1-2 sentences)
const PERSONALITY = {
  trash_talk: [
    "That play just shifted everything 👀 Who's fading this momentum?",
    "The energy just changed. Anyone else feeling it?",
    "That was either brilliant or a disaster. Your call? 🔥",
    "Momentum just swung HARD. Boost if you called it.",
  ],
  score_update: [
    "{score} — things are getting spicy 🔥",
    "{score} right now. Still confident or sweating?",
    "SCORE UPDATE: {score}. Who's winning the fades?",
  ],
  game_end: [
    "FINAL: {score}. Called it or got caught? 😤",
    "{score} — FINAL. Fade the losers 💀",
    "That's a wrap. {score}. Who nailed it?",
  ],
  fade_settle: [
    "💰 {winner} CASHES IN! {amount} from {loser}. Brutal.",
    "Fade settled 🔥 {winner} takes {amount} from {loser}",
    "{winner} called it. {loser} pays {amount} 💀",
  ],
  daily_prompt: [
    "Quiet in here... anyone got a hot take?",
    "What's the early read on {team}? Over/under expectations?",
    "Line's moving on {team}. Who's fading the public?",
    "Dead air. Drop your spiciest take 🔥",
  ],
  room_entry: [
    "You're in — something just popped 👀",
    "Welcome back. The room's been buzzing.",
    "Just in time. Things are heating up 🔥",
  ],
};

function getRandomPrompt(category: keyof typeof PERSONALITY): string {
  const prompts = PERSONALITY[category];
  return prompts[Math.floor(Math.random() * prompts.length)];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { huddle_id, team_name, trigger_type, context = {} }: CoachPromptRequest = await req.json();

    console.log(`🤖 @coach proactive prompt: ${trigger_type} for ${team_name}`);

    // Rate limit check - max 1 prompt per 2-3 minutes during live games
    const rateLimitMinutes = trigger_type === 'live_game' || trigger_type === 'score_update' ? 2 : 60;
    const cutoffTime = new Date(Date.now() - rateLimitMinutes * 60 * 1000).toISOString();

    const { data: recentPrompts } = await supabase
      .from('huddle_messages')
      .select('id')
      .eq('huddle_id', huddle_id)
      .eq('is_bot_message', true)
      .in('message_type', ['coach_prompt', 'score_update', 'coach_welcome'])
      .gte('created_at', cutoffTime)
      .limit(1);

    if (recentPrompts && recentPrompts.length > 0) {
      console.log(`⏱️ Rate limited: recent prompt within ${rateLimitMinutes} minutes`);
      return new Response(JSON.stringify({
        success: false,
        message: 'Rate limited',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get system user
    const { data: systemUserId } = await supabase.rpc('get_or_create_system_user');

    let message = '';
    let messageType = 'coach_prompt';

    switch (trigger_type) {
      case 'score_update':
        message = getRandomPrompt('score_update')
          .replace('{score}', context.score || 'Score update');
        messageType = 'score_update';
        break;

      case 'game_end':
        message = getRandomPrompt('game_end')
          .replace('{score}', context.score || 'Final score');
        messageType = 'game_end';
        break;

      case 'fade_settlement':
        message = getRandomPrompt('fade_settle')
          .replace('{winner}', context.fade_winner || 'Winner')
          .replace('{loser}', context.fade_loser || 'Loser')
          .replace('{amount}', String(context.fade_amount || 100));
        messageType = 'fade_settlement';
        break;

      case 'live_game':
        message = getRandomPrompt('trash_talk');
        if (context.event_description) {
          message = `${context.event_description}\n\n${message}`;
        }
        break;

      case 'daily':
      default:
        // For daily prompts, try to get recent content to reference
        const { data: recentContent } = await supabase
          .from('huddle_messages')
          .select('content')
          .eq('huddle_id', huddle_id)
          .eq('message_type', 'social_buzz')
          .order('created_at', { ascending: false })
          .limit(1);

        const snippet = recentContent?.[0]?.content
          ?.replace(/🔗\s*\[Source\]\([^)]+\)/gi, '')
          ?.replace(/\[([^\]]*)\]\([^)]+\)/g, '$1')
          ?.substring(0, 60) || '';

        message = getRandomPrompt('daily_prompt')
          .replace('{team}', team_name)
          .replace('{content}', snippet || 'the latest news');
        break;
    }

    // Post the message
    const { error: postError } = await supabase
      .from('huddle_messages')
      .insert({
        huddle_id,
        user_id: systemUserId,
        content: message,
        is_bot_message: true,
        message_type: messageType,
      });

    if (postError) {
      console.error('Error posting coach prompt:', postError);
      throw postError;
    }

    console.log(`✅ Posted @coach prompt: "${message.substring(0, 50)}..."`);

    return new Response(JSON.stringify({
      success: true,
      message_posted: message,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Coach proactive error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
