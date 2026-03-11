import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestPayload {
  word: string;
  definition: string;
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
    const { word, definition }: RequestPayload = await req.json();

    const scaffoldStyles = [
      {
        name: 'personal_memory',
        instruction: `The scaffoldPrompt should invite personal reflection about a memory. Ask the learner to recall a specific moment, event, or experience from their life that connects to the word's meaning. Example for "ephemeral": "Think of a moment that felt fleeting but stayed with you - a sunset, a conversation, a feeling. Describe it using this word."`
      },
      {
        name: 'person_you_know',
        instruction: `The scaffoldPrompt should ask about someone the learner knows. Have them think of a friend, family member, colleague, or acquaintance who embodies or relates to the word. Example for "gregarious": "Think of the most social person you know - someone who lights up every room. Describe what makes them this way."`
      },
      {
        name: 'pop_culture',
        instruction: `The scaffoldPrompt should reference movies, TV shows, books, or music. Ask the learner to connect the word to a character, scene, or story they know. Example for "hubris": "Think of a movie character whose downfall came from excessive pride. Describe their fatal flaw."`
      },
      {
        name: 'workplace_scenario',
        instruction: `The scaffoldPrompt should describe a work or professional scenario. Ask the learner to imagine or recall a workplace situation. Example for "meticulous": "Describe a coworker or project that required extreme attention to detail. What made it so?"`
      },
      {
        name: 'hypothetical_situation',
        instruction: `The scaffoldPrompt should present a hypothetical "what if" scenario. Give the learner an imaginative situation to respond to. Example for "serendipitous": "Imagine you took a wrong turn and it led to something wonderful. Describe that lucky accident."`
      },
      {
        name: 'sensory_description',
        instruction: `The scaffoldPrompt should focus on senses and physical experience. Ask the learner to describe something they can see, hear, taste, smell, or feel. Example for "cacophonous": "Describe the loudest, most chaotic soundscape you've experienced - a busy street, a concert, a kitchen during rush hour."`
      },
      {
        name: 'contrast_comparison',
        instruction: `The scaffoldPrompt should ask for a comparison or contrast. Have the learner compare two things or describe an opposite. Example for "tranquil": "Compare your most peaceful place to its opposite. What makes one tranquil and the other chaotic?"`
      }
    ];

    const selectedStyle = scaffoldStyles[Math.floor(Math.random() * scaffoldStyles.length)];
    const scaffoldInstructions = selectedStyle.instruction;

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
- ${scaffoldInstructions}
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
