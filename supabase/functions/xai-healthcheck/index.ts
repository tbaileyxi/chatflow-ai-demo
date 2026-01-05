import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const XAI_BASE_URL = 'https://api.x.ai/v1';

// Priority order for model selection
const MODEL_PRIORITY = [
  'grok-3.1-fast',
  'grok-4',
  'grok-3.1',
  'grok-3-fast',
  'grok-3',
  'grok-2-latest',
  'grok-2',
];

function selectBestModel(modelIds: string[]): string | null {
  const lowerModels = modelIds.map(id => id.toLowerCase());
  
  // Check priority list first
  for (const preferred of MODEL_PRIORITY) {
    const idx = lowerModels.findIndex(m => m === preferred.toLowerCase() || m.includes(preferred.toLowerCase()));
    if (idx !== -1) {
      return modelIds[idx];
    }
  }
  
  // Fallback: any model containing "grok"
  const grokModel = modelIds.find(id => id.toLowerCase().includes('grok'));
  if (grokModel) return grokModel;
  
  // Last resort: first model
  return modelIds.length > 0 ? modelIds[0] : null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    xai_api_key_present: false,
    models_status: null,
    model_ids: [],
    chosen_model: null,
    chat_status: null,
    chat_snippet: null,
    errors: []
  };

  try {
    const xaiApiKey = Deno.env.get('XAI_API_KEY');
    results.xai_api_key_present = !!xaiApiKey;

    if (!xaiApiKey) {
      results.errors.push('XAI_API_KEY not configured');
      return new Response(JSON.stringify(results), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 1: List available models
    const listModelsUrl = `${XAI_BASE_URL}/models`;
    console.log('[xai-healthcheck] Fetching models from:', listModelsUrl);

    const modelsResponse = await fetch(listModelsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${xaiApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    results.models_status = modelsResponse.status;

    if (!modelsResponse.ok) {
      const errorText = await modelsResponse.text();
      console.error('[xai-healthcheck] Models API error:', modelsResponse.status, errorText.slice(0, 500));
      results.errors.push(`Models API error: ${modelsResponse.status} - ${errorText.slice(0, 300)}`);
      
      return new Response(JSON.stringify(results), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const modelsData = await modelsResponse.json();
    console.log('[xai-healthcheck] Models response:', JSON.stringify(modelsData).slice(0, 800));

    // Extract model IDs - handle both array and object with data property
    let modelIds: string[] = [];
    if (Array.isArray(modelsData)) {
      modelIds = modelsData.map((m: any) => m.id || m.name).filter(Boolean);
    } else if (modelsData.data && Array.isArray(modelsData.data)) {
      modelIds = modelsData.data.map((m: any) => m.id || m.name).filter(Boolean);
    } else if (modelsData.models && Array.isArray(modelsData.models)) {
      modelIds = modelsData.models.map((m: any) => m.id || m.name).filter(Boolean);
    }

    results.model_ids = modelIds;
    console.log('[xai-healthcheck] Available models:', modelIds);

    // Step 2: Choose the best model using priority list
    const chosenModel = selectBestModel(modelIds);
    results.chosen_model = chosenModel;
    console.log('[xai-healthcheck] Chosen model:', chosenModel);

    if (!chosenModel) {
      results.errors.push('No suitable model found in available models');
      return new Response(JSON.stringify(results), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 3: Test chat completion with minimal tokens
    const chatUrl = `${XAI_BASE_URL}/chat/completions`;
    console.log('[xai-healthcheck] Testing chat at:', chatUrl, 'with model:', chosenModel);

    const chatResponse = await fetch(chatUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${xaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: chosenModel,
        messages: [
          { role: 'user', content: 'Say OK.' }
        ],
        max_tokens: 5
      }),
    });

    results.chat_status = chatResponse.status;

    if (!chatResponse.ok) {
      const errorText = await chatResponse.text();
      console.error('[xai-healthcheck] Chat API error:', chatResponse.status, errorText.slice(0, 500));
      results.errors.push(`Chat API error: ${chatResponse.status} - ${errorText.slice(0, 300)}`);
    } else {
      const chatData = await chatResponse.json();
      const content = chatData.choices?.[0]?.message?.content || '';
      results.chat_snippet = content.slice(0, 200);
      console.log('[xai-healthcheck] Chat response:', content);
    }

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[xai-healthcheck] Unexpected error:', error);
    results.errors.push(error.message || 'Unknown error');
    
    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
