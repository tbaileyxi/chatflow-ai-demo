import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const XAI_BASE_URL = 'https://api.x.ai/v1';

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

// Dynamically discover and choose best available model
async function discoverBestModel(apiKey: string): Promise<{ model: string; error?: string }> {
  const listModelsUrl = `${XAI_BASE_URL}/models`;
  
  console.log('[analyze-x-content-grok] Discovering models from:', listModelsUrl);
  
  try {
    const response = await fetch(listModelsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[analyze-x-content-grok] Models API error:', response.status, errorText.slice(0, 300));
      return { model: '', error: `Models API ${response.status}: ${errorText.slice(0, 100)}` };
    }

    const modelsData = await response.json();
    
    // Extract model IDs
    let modelIds: string[] = [];
    if (Array.isArray(modelsData)) {
      modelIds = modelsData.map((m: any) => m.id || m.name).filter(Boolean);
    } else if (modelsData.data && Array.isArray(modelsData.data)) {
      modelIds = modelsData.data.map((m: any) => m.id || m.name).filter(Boolean);
    } else if (modelsData.models && Array.isArray(modelsData.models)) {
      modelIds = modelsData.models.map((m: any) => m.id || m.name).filter(Boolean);
    }

    console.log('[analyze-x-content-grok] Available models:', modelIds);

    // Filter for grok models
    const grokModels = modelIds.filter(id => id.toLowerCase().includes('grok'));
    
    // Preference order for analysis tasks (prefer capable models)
    const modelPreference = [
      'grok-2-latest',
      'grok-2',
      'grok-2-1212',
      'grok-3',
      'grok-3-fast',
      'grok-2-mini',
      'grok-1',
    ];

    for (const preferred of modelPreference) {
      const found = grokModels.find(m => m.toLowerCase().includes(preferred.toLowerCase()));
      if (found) {
        console.log('[analyze-x-content-grok] Chosen model:', found);
        return { model: found };
      }
    }

    // Fallback to any grok model
    if (grokModels.length > 0) {
      console.log('[analyze-x-content-grok] Fallback to first grok model:', grokModels[0]);
      return { model: grokModels[0] };
    }

    // Fallback to any model
    if (modelIds.length > 0) {
      console.log('[analyze-x-content-grok] Fallback to first available model:', modelIds[0]);
      return { model: modelIds[0] };
    }

    return { model: '', error: 'No models available' };
  } catch (error: any) {
    console.error('[analyze-x-content-grok] Model discovery error:', error);
    return { model: '', error: error.message };
  }
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

    // Discover best available model dynamically
    const { model: chosenModel, error: modelError } = await discoverBestModel(xaiApiKey);
    
    if (!chosenModel) {
      console.error('[analyze-x-content-grok] No model available:', modelError);
      throw new Error(`No xAI model available: ${modelError}`);
    }

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

    console.log('[analyze-x-content-grok] Analyzing tweet:', {
      author: requestData.authorUsername,
      hasMedia: requestData.hasMedia,
      mediaType: requestData.mediaType,
      hoursOld: Math.round(hoursOld),
      chosenModel
    });

    const chatUrl = `${XAI_BASE_URL}/chat/completions`;
    console.log('[analyze-x-content-grok] Chat URL:', chatUrl, 'Model:', chosenModel);

    const response = await fetch(chatUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${xaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: chosenModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        // Only use response_format if model supports it (grok-2+ models)
        ...(chosenModel.includes('grok-2') || chosenModel.includes('grok-3') 
          ? { response_format: { type: "json_object" } } 
          : {})
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[analyze-x-content-grok] API Error:', response.status, errorText.slice(0, 300));
      throw new Error(`Grok API error: ${response.status}`);
    }

    const grokData = await response.json();
    const grokContent = grokData.choices?.[0]?.message?.content;
    
    if (!grokContent) {
      throw new Error('No content in Grok response');
    }

    console.log('[analyze-x-content-grok] Raw response:', grokContent.slice(0, 500));

    // Parse Grok response
    let analysis: GrokAnalysisResponse;
    try {
      // Try to extract JSON from response (handle potential markdown wrapping)
      let jsonStr = grokContent.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
      }
      analysis = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('[analyze-x-content-grok] Failed to parse response:', grokContent.slice(0, 200));
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

    console.log('[analyze-x-content-grok] Final analysis:', {
      quality_score: analysis.quality_score,
      has_teams: analysis.team_ids.length > 0,
      highlight_worthy: analysis.highlight_worthy,
      topics: analysis.topics,
      model_used: chosenModel
    });

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[analyze-x-content-grok] Error:', error);
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
