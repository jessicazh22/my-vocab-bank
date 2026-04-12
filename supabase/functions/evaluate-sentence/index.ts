import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestPayload {
  word: string;
  definition: string;
  sentence: string;
}

interface EvaluationResponse {
  correct: boolean;
  feedback: string;
}

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (!GROQ_API_KEY) {
    return new Response(JSON.stringify({ error: "GROQ_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { word, definition, sentence }: RequestPayload = await req.json();

    const systemPrompt = `You are a vocabulary coach evaluating a student's sentence.

Given a word, its definition, and a student's sentence, evaluate the usage and suggest an improvement.

Return ONLY this JSON:
{
  "correct": true/false,
  "feedback": "One sentence on whether the target word is used correctly, followed by: 'One way you could improve this is to rephrase [quote the specific awkward phrase] — try [concrete alternative] instead.'"
}

Rules:
- First part of feedback: focus solely on whether the target word's meaning and usage is correct
- Second part: quote the specific phrase that's awkward or unclear, then give a concrete inline alternative. Start with "One way you could improve this is..."
- If the sentence is already strong and idiomatic, suggest a richer or more vivid variation instead
- Never use structural terms like "first clause", "second clause", or "this construction"
- Keep the full feedback to 2-3 sentences max
- Be constructive and specific — vague praise like "great sentence!" is not useful
- Return ONLY the JSON object, no other text`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Word: "${word}"\nDefinition: "${definition}"\nStudent's sentence: "${sentence}"` },
        ],
        max_tokens: 250,
        temperature: 0.3,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: "AI request failed", details: data }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const content = data.choices?.[0]?.message?.content || "";

    let evaluation: EvaluationResponse;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        evaluation = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch {
      evaluation = {
        correct: true,
        feedback: "Great job practicing!",
      };
    }

    return new Response(
      JSON.stringify(evaluation),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Failed to process request", details: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
