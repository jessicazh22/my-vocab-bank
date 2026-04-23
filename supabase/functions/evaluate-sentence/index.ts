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

interface Swap {
  original: string;
  improved: string;
  reason: string;
}

interface EvaluationResponse {
  correct: boolean;
  meaningCorrection?: string | null;
  structureNote?: string | null;
  swaps: Swap[];
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

    const systemPrompt = `You are a vocabulary coach giving surgical feedback on a student's sentence.

Return ONLY this JSON:
{
  "correct": true/false,
  "meaningCorrection": null,
  "structureNote": null,
  "swaps": []
}

Rules:
- correct: true if the target word is used with the right meaning, false if not
- meaningCorrection: if correct=false, one sentence explaining the right meaning and how to fix it. Set to null if correct=true. When correct=false, set swaps to [] — don't critique style when the meaning is wrong.
- structureNote: a short label (max 8 words) for a genuine structural issue only — e.g. "tells the feeling rather than showing it", "fragment — needs a main verb", "redundant — the word already implies this". Set to null if the sentence is structurally fine.
- swaps: 1–2 surgical phrase replacements that improve the sentence. Each swap must:
  - "original": an exact phrase from the student's sentence (copy it verbatim)
  - "improved": a better replacement phrase
  - "reason": one short phrase explaining why — e.g. "more idiomatic", "more active", "already implied by ${word}", "shows rather than names the feeling", "tighter"
  Keep the student's sentence structure — swap phrases, never rewrite the whole thing. Focus on: unnatural phrasing, word choice that undersells the target word, endings that tell instead of show, or redundancy. If the sentence is already strong, return swaps: [].
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
        // Ensure swaps is always an array
        if (!Array.isArray(evaluation.swaps)) evaluation.swaps = [];
      } else {
        throw new Error("No JSON found in response");
      }
    } catch {
      evaluation = {
        correct: true,
        meaningCorrection: null,
        structureNote: null,
        swaps: [],
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
