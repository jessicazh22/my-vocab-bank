import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestPayload {
  word: string;
  definition?: string;
  sentence?: string;
  mode?: string;
  scaffoldOnly?: boolean;
  defineOnly?: boolean;
  shortPhraseOnly?: boolean;
}

interface EnrichmentResponse {
  examples: string[];
  context: string;
  scaffoldPrompt: string;
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
    const { word, definition, sentence, mode, scaffoldOnly, defineOnly, shortPhraseOnly }: RequestPayload = await req.json();

    // Sentence check mode — verify a user's sentence uses the word correctly
    if (mode === 'checkSentence') {
      const checkPrompt = `The vocabulary word is "${word}"${definition ? ` (meaning: "${definition}")` : ''}. The learner wrote this sentence: "${sentence}". Does this sentence correctly demonstrate the word's meaning? Reply in 1 short, warm, encouraging sentence. If good, confirm it. If off, gently note why and suggest a tweak. Return ONLY: {"feedback": "your feedback here"}`;
      const checkResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "user", content: checkPrompt }],
          max_tokens: 100,
          temperature: 0.4,
        }),
      });
      const checkData = await checkResponse.json();
      const checkContent = checkData.choices?.[0]?.message?.content || "";
      try {
        const jsonMatch = checkContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return new Response(JSON.stringify({ feedback: parsed.feedback }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch { /* fall through */ }
      return new Response(JSON.stringify({ feedback: "Looks good!" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Short phrase mode — just a brief 6-10 word descriptor, no examples or context
    if (shortPhraseOnly) {
      const shortPrompt = `Give a short, punchy description of the phrase "${word}" in 6-10 words. It should read like a dictionary gloss — no full sentences, no "it means", just a compact descriptor. Examples: "provisional belief accepted as true in order to proceed" or "quietly but firmly turned away or discouraged". Return ONLY a JSON object: {"definition": "your short description here"}`;
      const shortResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "user", content: shortPrompt }],
          max_tokens: 80,
          temperature: 0.3,
        }),
      });
      const shortData = await shortResponse.json();
      const shortContent = shortData.choices?.[0]?.message?.content || "";
      try {
        const jsonMatch = shortContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return new Response(JSON.stringify({ definition: parsed.definition }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch { /* fall through */ }
      return new Response(JSON.stringify({ error: "Could not generate short definition" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Quick define mode — short definition + examples + context for a word with no definition
    if (defineOnly) {
      const definePrompt = `For the word "${word}", provide a short definition and learning content.
Return ONLY a JSON object:
{
  "definition": "Compact 5-10 word gloss, no full sentences. Like: concise and packed with meaning",
  "examples": ["example 1", "example 2", "example 3"],
  "context": "When and where to use this word. 2 sentences max.",
  "scaffoldPrompt": "A short personal question (under 25 words) to help the learner use this word."
}`;

      const defineResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "user", content: definePrompt }],
          max_tokens: 400,
          temperature: 0.5,
        }),
      });

      const defineData = await defineResponse.json();
      const defineContent = defineData.choices?.[0]?.message?.content || "";
      try {
        const stripped = defineContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
        const jsonMatch = stripped.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.definition) {
            return new Response(JSON.stringify(parsed), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      } catch (e) {
        console.error("defineOnly parse error:", e, "content:", defineContent);
      }
      return new Response(JSON.stringify({ error: "Could not generate definition" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const scaffoldStyles = [
      `Ask about someone the learner knows. Example for "pithy": "Think of someone you know who always gets straight to the point. How would you describe the way they communicate?"`,
      `Ask the learner to recall a specific memory. Example for "ephemeral": "Think of a moment that felt fleeting but stayed with you. How would you describe it?"`,
      `Reference a movie, show, or book. Example for "hubris": "Think of a character whose pride led to their downfall. What happened?"`,
      `Ask about a workplace or school moment. Example for "meticulous": "Think of a time extreme attention to detail really mattered. What was at stake?"`,
      `Present a simple hypothetical. Example for "serendipitous": "Imagine a wrong turn led to something wonderful. What happened?"`,
      `Ask about a feeling or sensory experience. Example for "cacophonous": "What's the loudest, most chaotic place you've ever been?"`,
    ];

    const scaffoldInstructions = scaffoldStyles[Math.floor(Math.random() * scaffoldStyles.length)];

    if (scaffoldOnly) {
      const scaffoldPrompt = `Generate a short scaffold prompt (1-2 sentences, under 25 words) to help a learner use the word "${word}" (meaning: "${definition}") in a sentence. It should be a simple personal question. No roleplay. Style: ${scaffoldInstructions}. Return ONLY a JSON object: {"scaffoldPrompt": "your prompt here"}`;

      const scaffoldResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            { role: "user", content: scaffoldPrompt },
          ],
          max_tokens: 100,
          temperature: 0.7,
        }),
      });

      const scaffoldData = await scaffoldResponse.json();
      const scaffoldContent = scaffoldData.choices?.[0]?.message?.content || "";
      try {
        const jsonMatch = scaffoldContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return new Response(JSON.stringify(parsed), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch {
        // Fall through to full enrichment
      }
    }

    const systemPrompt = `You are a vocabulary enrichment assistant. Given a word and its definition, generate helpful learning content.

Return a JSON object with exactly this structure:
{
  "examples": ["example 1", "example 2", "example 3"],
  "context": "Use in X, Y, or Z contexts to describe/praise/criticize [specific use]. Works well in [setting].",
  "scaffoldPrompt": "A reflection prompt to help the learner connect this word to their experience"
}

Guidelines:
- Provide exactly 3 diverse example sentences that clearly demonstrate the word's meaning
- Examples should be natural, memorable, and show different contexts
- Context should be 2 sentences max. First sentence starts with an action verb like "Use in..." explaining WHERE and WHY. Second sentence describes the setting or tone. Example: "Use in business, politics, or creative contexts to praise early recognition of trends or outcomes. Works well in formal writing and professional discussions."
- scaffoldPrompt MUST be 1-2 short sentences max (under 25 words). It should be a simple personal question that connects the word to the learner's life. No roleplay scenarios. No complex setups. Style: ${scaffoldInstructions}
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
          { role: "user", content: `Word: "${word}"\nDefinition: "${definition}"` },
        ],
        max_tokens: 400,
        temperature: 0.7,
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

    let enrichment: EnrichmentResponse;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        enrichment = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch {
      enrichment = {
        examples: ["Unable to generate examples."],
        context: "Unable to generate context.",
        scaffoldPrompt: "",
      };
    }

    return new Response(
      JSON.stringify(enrichment),
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
