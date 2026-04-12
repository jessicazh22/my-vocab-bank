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
  suggestion?: string | null;
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

Return ONLY this JSON:
{
  "correct": true/false,
  "feedback": "One sentence: is the target word used correctly?",
  "suggestion": null
}

Rules:
- feedback: focus on whether the target word is used correctly
- suggestion: read the whole sentence as a native speaker. If any phrase sounds unnatural or awkward, quote it and give a natural alternative (e.g. "about-to-become father" → "expectant father" or "soon-to-be father"). Return null if the sentence already sounds natural — do NOT force a suggestion.
- Never use structural terms like "first clause", "second clause"
- Keep feedback and suggestion to 1–2 sentences each
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
        max_tokens: 150,
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
