import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { messages, model, max_tokens, temperature } = await req.json()

    const apiKey = Deno.env.get('MEGALLM_API_KEY')
    if (!apiKey) {
      throw new Error('MEGALLM_API_KEY not configured')
    }

    const response = await fetch('https://ai.megallm.io/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'openai-gpt-oss-20b',
        messages,
        max_tokens: max_tokens || 500,
        temperature: temperature ?? 0.7,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return new Response(
        JSON.stringify({ error: `MegaLLM API error: ${response.status} - ${errorText}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const data = await response.json()

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
