import "jsr:@supabase/functions-js/edge-runtime.d.ts"

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { prompt } = await req.json()
    const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')

    if (!GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not set')
    }

    if (!prompt) {
      throw new Error('Prompt is required')
    }

    // Call Groq API (stream=true)
    const groqUrl = `https://api.groq.com/openai/v1/chat/completions`

    const response = await fetch(groqUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        messages: [
          { role: "system", content: "You are Investrade AI, a world-class Pitch Coach and Startup Advisor. Be concise, brilliant, and directly helpful to founders and investors. Format your responses in clean markdown." },
          { role: "user", content: prompt }
        ],
        stream: true
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error("Groq Error:", errText)
      throw new Error(`Groq API error: ${response.status}`)
    }

    // Return the stream directly to the client
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })

  } catch (error) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
