import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const XAI_BASE_URL = 'https://api.x.ai/v1';

// Priority order for model selection - EXACT match preference
const MODEL_PRIORITY = [
  'grok-3.1-fast',
  'grok-3.1',
  'grok-3-fast',
  'grok-3',
];

function selectBestModel(modelIds: string[]): string | null {
  // First pass: exact match from priority list
  for (const preferred of MODEL_PRIORITY) {
    const exact = modelIds.find(m => m.toLowerCase() === preferred.toLowerCase());
    if (exact) return exact;
  }
  
  // Second pass: partial match from priority list
  for (const preferred of MODEL_PRIORITY) {
    const partial = modelIds.find(m => m.toLowerCase().includes(preferred.toLowerCase()));
    if (partial) return partial;
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
    ok: false,
    xai_api_key_present: false,
    models_status: null,
    models: [],
    chosen_model: null,
    chat_status: null,
    chat_snippet: null,
    errors: []
  };

  try {
    const xaiApiKey = Deno.env.get('XAI_API_KEY');
    results.xai_api_key_present = !!xaiApiKey;

    if (!xaiApiKey) {
      results.errors.push('XAI_API_KEY is not configured in Supabase secrets. Add it at: Supabase Dashboard > Settings > Secrets');
      console.error('[xai-healthcheck] XAI_API_KEY missing');
      return new Response(JSON.stringify(results), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 1: List available models
    const listModelsUrl = `${XAI_BASE_URL}/models`;
    console.log('[xai-healthcheck] Fetching models from:', listModelsUrl);

    let modelsResponse: Response;
    try {
      modelsResponse = await fetch(listModelsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${xaiApiKey}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (fetchError: any) {
      results.errors.push(`Network error fetching models: ${fetchError.message}`);
      console.error('[xai-healthcheck] Network error:', fetchError);
      return new Response(JSON.stringify(results), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    results.models_status = modelsResponse.status;

    if (!modelsResponse.ok) {
      const errorText = await modelsResponse.text();
      const errorSnippet = errorText.slice(0, 1500);
      console.error('[xai-healthcheck] Models API error:', modelsResponse.status, errorSnippet);
      results.errors.push(`Models API error ${modelsResponse.status}: ${errorSnippet}`);
      
      return new Response(JSON.stringify(results), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const modelsData = await modelsResponse.json();
    console.log('[xai-healthcheck] Models response structure:', Object.keys(modelsData));

    // Extract model IDs - handle different API response formats
    let modelIds: string[] = [];
    if (Array.isArray(modelsData)) {
      modelIds = modelsData.map((m: any) => m.id || m.name).filter(Boolean);
    } else if (modelsData.data && Array.isArray(modelsData.data)) {
      modelIds = modelsData.data.map((m: any) => m.id || m.name).filter(Boolean);
    } else if (modelsData.models && Array.isArray(modelsData.models)) {
      modelIds = modelsData.models.map((m: any) => m.id || m.name).filter(Boolean);
    }

    results.models = modelIds;
    console.log('[xai-healthcheck] Available models:', modelIds);

    // Step 2: Choose the best model using priority list
    const chosenModel = selectBestModel(modelIds);
    results.chosen_model = chosenModel;
    console.log('[xai-healthcheck] Chosen model:', chosenModel);

    if (!chosenModel) {
      results.errors.push('No suitable model found. Available models: ' + modelIds.join(', '));
      return new Response(JSON.stringify(results), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 3: Test chat completion with minimal tokens
    const chatUrl = `${XAI_BASE_URL}/chat/completions`;
    console.log('[xai-healthcheck] Testing chat at:', chatUrl, 'with model:', chosenModel);

    let chatResponse: Response;
    try {
      chatResponse = await fetch(chatUrl, {
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
    } catch (fetchError: any) {
      results.errors.push(`Network error during chat test: ${fetchError.message}`);
      console.error('[xai-healthcheck] Chat network error:', fetchError);
      return new Response(JSON.stringify(results), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    results.chat_status = chatResponse.status;

    if (!chatResponse.ok) {
      const errorText = await chatResponse.text();
      const errorSnippet = errorText.slice(0, 1500);
      console.error('[xai-healthcheck] Chat API error:', chatResponse.status, errorSnippet);
      results.errors.push(`Chat API error ${chatResponse.status}: ${errorSnippet}`);
    } else {
      const chatData = await chatResponse.json();
      const content = chatData.choices?.[0]?.message?.content || '';
      results.chat_snippet = content.slice(0, 200);
      console.log('[xai-healthcheck] Chat response:', content);
      
      // Mark as OK only if both models and chat succeeded
      results.ok = true;
    }

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[xai-healthcheck] Unexpected error:', error);
    results.errors.push(`Unexpected error: ${error.message || 'Unknown error'}`);
    
    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
