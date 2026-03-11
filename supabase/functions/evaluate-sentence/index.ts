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

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") || "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";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { word, definition, sentence }: RequestPayload = await req.json();

    const systemPrompt = `You are a vocabulary learning assistant evaluating a student's sentence.

Given a word, its definition, and a sentence the student wrote using that word, evaluate if the usage is correct.

Return a JSON object with exactly this structure:
{
  "correct": true/false,
  "feedback": "Brief, encouraging feedback"
}

Guidelines:
- Be encouraging even when correcting
- If correct, briefly acknowledge what they did well
- If incorrect, explain the issue gently and give a quick tip
- Keep feedback to 1-2 sentences max
- Focus on meaning/usage, not grammar unless it affects meaning
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
