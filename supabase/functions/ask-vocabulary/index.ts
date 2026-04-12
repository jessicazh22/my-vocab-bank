import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface RequestPayload {
  word: string;
  definition?: string;
  question: string;
  history?: ChatMessage[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { word, definition, question, history = [] }: RequestPayload = await req.json();

    const systemPrompt = `You are a helpful vocabulary assistant. The user is learning the word or phrase "${word}"${definition ? ` which means: "${definition}"` : ""}.

Answer their questions concisely and helpfully. Keep responses brief (2-4 sentences) but informative. Focus on practical usage, nuance, or clarification. If they ask you to use it in conversation with them, engage naturally and help them practice.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...history.map(msg => ({ role: msg.role, content: msg.content })),
      { role: "user", content: question },
    ];

    // Try Groq first, fall back to OpenAI if needed
    const groqKey = Deno.env.get("GROQ_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    
    let apiUrl: string;
    let headers: Record<string, string>;
    
    if (groqKey) {
      apiUrl = "https://api.groq.com/openai/v1/chat/completions";
      headers = {
        "Authorization": `Bearer ${groqKey}`,
        "Content-Type": "application/json",
      };
    } else if (openaiKey) {
      apiUrl = "https://api.openai.com/v1/chat/completions";
      headers = {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      };
    } else {
      return new Response(
        JSON.stringify({ error: "No API key configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: groqKey ? "llama-3.1-8b-instant" : "gpt-3.5-turbo",
        messages,
        max_tokens: 250,
        temperature: 0.7,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[ask-vocabulary] API error:', { status: response.status, data });
      return new Response(
        JSON.stringify({ error: "AI request failed", details: data }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const answer = data.choices?.[0]?.message?.content || "Unable to generate a response.";

    return new Response(
      JSON.stringify({ answer }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error('[ask-vocabulary] Exception:', error);
    return new Response(
      JSON.stringify({ error: "Failed to process request", details: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
