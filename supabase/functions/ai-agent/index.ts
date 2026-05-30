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
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')

    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set')
    }

    if (!prompt) {
      throw new Error('Prompt is required')
    }

    // Call Gemini API (stream=true)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        systemInstruction: {
          role: "user",
          parts: [{ text: "You are Investrade AI, a world-class Pitch Coach and Startup Advisor. Be concise, brilliant, and directly helpful to founders and investors. Format your responses in clean markdown." }]
        }
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error("Gemini Error:", errText)
      throw new Error(`Gemini API error: ${response.status}`)
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
