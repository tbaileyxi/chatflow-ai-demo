import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GrokAnalysisRequest {
  tweetContent: string;
  tweetUrl: string;
  authorUsername: string;
  hasMedia: boolean;
  mediaType?: string;
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
  };
  createdAt: string;
}

interface GrokAnalysisResponse {
  team_ids: string[];
  quality_score: number;
  topics: string[];
  broadcast_to: string[];
  highlight_worthy: boolean;
  reasoning: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const xaiApiKey = Deno.env.get('XAI_API_KEY');
    if (!xaiApiKey) {
      throw new Error('XAI_API_KEY not configured');
    }

    const requestData: GrokAnalysisRequest = await req.json();
    
    // Calculate time recency bonus
    const tweetTime = new Date(requestData.createdAt).getTime();
    const now = Date.now();
    const hoursOld = (now - tweetTime) / (1000 * 60 * 60);
    const recencyBonus = hoursOld < 6 ? 15 : hoursOld < 24 ? 10 : 0;

    // Build analysis prompt
    const systemPrompt = `You are an NFL/NCAA sports content analyzer. Analyze tweets and return ONLY valid JSON (no markdown, no code blocks).

QUALITY SCORING (0-100):
Base Score Rules:
- Text-only posts: Max 40 base points
- Posts with images: Max 60 base points  
- Posts with video/highlights: Max 75 base points

Bonuses:
- Game highlights/big plays: +25
- Breaking news/injury reports: +20
- High engagement (>100 likes): +10
- Posted within 6 hours: +15
- Posted within 24 hours: +10

Quality Thresholds:
- 85+: Auto-highlight worthy (instant spotlight)
- 70-84: Auto-approved (pending broadcast)
- 50-69: Manual review needed
- <50: Reject (too low quality)

TOPICS:
game_highlights, injury_report, trade_news, practice_update, player_stats, 
game_recap, coaching_news, roster_move, social_moment, pregame_hype

TEAMS DATABASE (match by keywords):
- Buffalo Bills: bills, buffalo, josh allen, stefon diggs
- Cleveland Browns: browns, cleveland, deshaun watson, myles garrett  
- Colorado Buffaloes: buffs, colorado, deion sanders, travis hunter, shedeur sanders

Return JSON only:
{
  "team_ids": ["team-uuid-or-empty"],
  "quality_score": 0-100,
  "topics": ["topic1", "topic2"],
  "broadcast_to": ["spotlight", "team_feed"],
  "highlight_worthy": true/false,
  "reasoning": "Brief explanation of score"
}`;

    const userPrompt = `Analyze this tweet:

Content: ${requestData.tweetContent}
Author: @${requestData.authorUsername}
Has Media: ${requestData.hasMedia ? `Yes (${requestData.mediaType})` : 'No'}
Engagement: ${requestData.metrics.likes} likes, ${requestData.metrics.retweets} RTs, ${requestData.metrics.replies} replies
Age: ${Math.round(hoursOld)} hours old

Apply quality scoring rules (media posts get higher base scores). Return JSON only.`;

    console.log('[Grok] Analyzing tweet:', {
      author: requestData.authorUsername,
      hasMedia: requestData.hasMedia,
      mediaType: requestData.mediaType,
      hoursOld: Math.round(hoursOld)
    });

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${xaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-2-1212',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Grok] API Error:', response.status, errorText);
      throw new Error(`Grok API error: ${response.status}`);
    }

    const grokData = await response.json();
    const grokContent = grokData.choices?.[0]?.message?.content;
    
    if (!grokContent) {
      throw new Error('No content in Grok response');
    }

    console.log('[Grok] Raw response:', grokContent);

    // Parse Grok response
    let analysis: GrokAnalysisResponse;
    try {
      analysis = JSON.parse(grokContent);
    } catch (parseError) {
      console.error('[Grok] Failed to parse response:', grokContent);
      // Return default low-quality score on parse error
      analysis = {
        team_ids: [],
        quality_score: 30,
        topics: ['uncategorized'],
        broadcast_to: [],
        highlight_worthy: false,
        reasoning: 'Failed to parse Grok response'
      };
    }

    // Apply recency bonus
    analysis.quality_score = Math.min(100, analysis.quality_score + recencyBonus);

    console.log('[Grok] Final analysis:', {
      quality_score: analysis.quality_score,
      has_teams: analysis.team_ids.length > 0,
      highlight_worthy: analysis.highlight_worthy,
      topics: analysis.topics
    });

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[Grok] Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      team_ids: [],
      quality_score: 30,
      topics: ['error'],
      broadcast_to: [],
      highlight_worthy: false,
      reasoning: 'Analysis failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
