import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// xAI API base URL
const XAI_BASE_URL = 'https://api.x.ai/v1';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    xai_api_key_set: false,
    list_models_url_used: null,
    list_models_status: null,
    available_models: [],
    chosen_model: null,
    chat_url_used: null,
    chat_status: null,
    chat_response_snippet: null,
    errors: []
  };

  try {
    const xaiApiKey = Deno.env.get('XAI_API_KEY');
    results.xai_api_key_set = !!xaiApiKey;

    if (!xaiApiKey) {
      results.errors.push('XAI_API_KEY not configured');
      return new Response(JSON.stringify(results), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 1: List available models
    const listModelsUrl = `${XAI_BASE_URL}/models`;
    results.list_models_url_used = listModelsUrl;

    console.log('[xai-healthcheck] Fetching models from:', listModelsUrl);

    const modelsResponse = await fetch(listModelsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${xaiApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    results.list_models_status = modelsResponse.status;

    if (!modelsResponse.ok) {
      const errorText = await modelsResponse.text();
      console.error('[xai-healthcheck] Models API error:', modelsResponse.status, errorText.slice(0, 300));
      results.errors.push(`Models API error: ${modelsResponse.status} - ${errorText.slice(0, 300)}`);
      
      return new Response(JSON.stringify(results), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const modelsData = await modelsResponse.json();
    console.log('[xai-healthcheck] Models response:', JSON.stringify(modelsData).slice(0, 500));

    // Extract model IDs - handle both array and object with data property
    let modelIds: string[] = [];
    if (Array.isArray(modelsData)) {
      modelIds = modelsData.map((m: any) => m.id || m.name).filter(Boolean);
    } else if (modelsData.data && Array.isArray(modelsData.data)) {
      modelIds = modelsData.data.map((m: any) => m.id || m.name).filter(Boolean);
    } else if (modelsData.models && Array.isArray(modelsData.models)) {
      modelIds = modelsData.models.map((m: any) => m.id || m.name).filter(Boolean);
    }

    results.available_models = modelIds;
    console.log('[xai-healthcheck] Available models:', modelIds);

    // Step 2: Choose the best grok model
    // Prefer newer models, avoid deprecated ones
    const grokModels = modelIds.filter(id => id.toLowerCase().includes('grok'));
    
    // Sort by preference: grok-3 > grok-2 > grok-1, prefer non-mini, prefer fast
    const modelPreference = [
      'grok-3-fast',
      'grok-3',
      'grok-2-latest',
      'grok-2',
      'grok-2-1212',
      'grok-2-mini',
      'grok-1',
    ];

    let chosenModel: string | null = null;
    for (const preferred of modelPreference) {
      const found = grokModels.find(m => m.toLowerCase().includes(preferred.toLowerCase()));
      if (found) {
        chosenModel = found;
        break;
      }
    }

    // Fallback to any grok model
    if (!chosenModel && grokModels.length > 0) {
      chosenModel = grokModels[0];
    }

    // Fallback to any available model
    if (!chosenModel && modelIds.length > 0) {
      chosenModel = modelIds[0];
    }

    results.chosen_model = chosenModel;
    console.log('[xai-healthcheck] Chosen model:', chosenModel);

    if (!chosenModel) {
      results.errors.push('No suitable model found');
      return new Response(JSON.stringify(results), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 3: Test chat completion
    const chatUrl = `${XAI_BASE_URL}/chat/completions`;
    results.chat_url_used = chatUrl;

    console.log('[xai-healthcheck] Testing chat with model:', chosenModel);

    const chatResponse = await fetch(chatUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${xaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: chosenModel,
        messages: [
          { role: 'user', content: 'Say OK in one word.' }
        ],
        temperature: 0.3,
        max_tokens: 10
      }),
    });

    results.chat_status = chatResponse.status;

    if (!chatResponse.ok) {
      const errorText = await chatResponse.text();
      console.error('[xai-healthcheck] Chat API error:', chatResponse.status, errorText.slice(0, 300));
      results.errors.push(`Chat API error: ${chatResponse.status} - ${errorText.slice(0, 300)}`);
    } else {
      const chatData = await chatResponse.json();
      const content = chatData.choices?.[0]?.message?.content || '';
      results.chat_response_snippet = content.slice(0, 200);
      console.log('[xai-healthcheck] Chat response:', content);
    }

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[xai-healthcheck] Error:', error);
    results.errors.push(error.message || 'Unknown error');
    
    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
