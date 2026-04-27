import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") || "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";

interface GrammarPattern {
  name: string;
  structure: string;
  examples: string[];
}

interface GrammarErrorRaw {
  original_phrase: string;
  correction: string;
  category: string;
  explanation: string;
  context_snippet: string;
  grammar_pattern?: GrammarPattern;
}

interface StyleSuggestionRaw {
  original_phrase: string;
  suggested: string;
  suggestion_type: string;
  explanation: string;
  context_snippet?: string;
}

interface PositiveFeedbackRaw {
  segment: string;
  feedback: string;
}

interface AnalysisResult {
  errors: GrammarErrorRaw[];
  style_suggestions: StyleSuggestionRaw[];
  positive_feedback: PositiveFeedbackRaw[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { transcript, locale } = await req.json() as { transcript: string; locale?: string };

    if (!transcript || typeof transcript !== "string") {
      return new Response(
        JSON.stringify({ error: "transcript is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;

    // Short transcript — too little to analyse
    if (wordCount < 20) {
      const result: AnalysisResult = {
        errors: [],
        style_suggestions: [],
        positive_feedback: [{
          segment: transcript.trim(),
          feedback: "Keep going — the more you speak, the richer the coaching!",
        }],
      };
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isAU = locale === "en-AU" || locale == null;
    const spellVariant = isAU
      ? "Australian/British English (organise, colour, analyse, realise, etc.)"
      : "American English (organize, color, analyze, realize, etc.)";

    const systemPrompt = `You are a friendly, encouraging English language coach — not a grammar examiner.
Your job: help non-native speakers identify real grammar errors and refine their expression.
Be warm, specific, and never alarming. Coach, don't correct.

The speaker uses ${spellVariant}. Do NOT flag the correct spelling variant as an error.

━━ GRAMMAR ERRORS ━━
Flag ONLY clear grammar violations a native speaker would notice. Use these category strings exactly:
  tense_consistency, subject_verb_agreement, modal_verb_pattern,
  article_misuse, demonstrative_agreement,
  singular_plural, uncountable_noun, redundant_words,
  verb_pattern, verb_form, verb_choice, verb_missing, verb_redundancy,
  irregular_verb_form, comparative_form,
  preposition_errors, phrasal_verb_errors,
  conjunction_misuse, conjunction_missing, parallel_structure,
  sentence_structure, word_order, pronoun_form,
  subjunctive_errors, word_form, word_choice, vague_reference

For EACH error output:
  "original_phrase": exact spoken phrase WITHOUT filler words (strip um/uh/like from the phrase)
  "correction": corrected version (can offer alternatives with " / ")
  "category": one exact string from the list above
  "explanation": 1–2 sentences, coaching tone, explain the rule plainly
  "context_snippet": "...surrounding words [original phrase] more words..."
  "grammar_pattern" (OPTIONAL — only for systematic, teachable patterns):
    { "name": "short label", "structure": "rule in plain English", "examples": ["3–4 examples"] }

If the same error repeats (e.g. subject–verb agreement missed twice), note it once and mention it appeared twice.

━━ DO NOT FLAG as grammar_errors ━━
- Filler words: um, uh, like, you know, kinda, cuz
- Repetitions while thinking: "we we usually", "what what she said"
- Self-corrections: speaker catches and fixes mid-sentence (e.g. "I could saw — I could see")
- Informal contractions: gonna, wanna — ONLY flag if the auxiliary verb is missing ("we gonna" needs "are")
- Written-vs-spoken distinctions: "everyday" vs "every day" sounds identical — not an error
- Borderline acceptable usages (e.g. "the Earth" vs "Earth" — both fine)

━━ STYLE SUGGESTIONS ━━
Separate from errors. Grammatically correct but could be more natural or polished.
Surface 0–5 only — genuinely meaningful upgrades. Types (use exact strings):
  collocation_word_choice, expression_upgrade, conciseness, phrasing,
  parallel_structure, redundant_words, sentence_structure, natural_expression

━━ POSITIVE FEEDBACK ━━
Always return 2–3 items. Quote SPECIFIC segments from the transcript. Explain WHY it's good:
sophisticated vocabulary, cultural insight, clear reasoning, good sentence structure, specific details.
Be enthusiastic but specific — not just "great job!".

Return ONLY a JSON object — no markdown, no preamble:
{
  "errors": [...],
  "style_suggestions": [...],
  "positive_feedback": [{ "segment": "...", "feedback": "..." }, ...]
}`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analyse this spoken transcript:\n\n"${transcript}"` },
        ],
        max_tokens: 2000,
        temperature: 0.2,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Groq error:", data);
      return new Response(
        JSON.stringify({ error: "AI request failed", details: data }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const content: string = data.choices?.[0]?.message?.content ?? "";

    let result: AnalysisResult;
    try {
      // Strip markdown fences if present
      const stripped = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      const jsonMatch = stripped.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      const parsed = JSON.parse(jsonMatch[0]);
      result = {
        errors: Array.isArray(parsed.errors) ? parsed.errors : [],
        style_suggestions: Array.isArray(parsed.style_suggestions) ? parsed.style_suggestions : [],
        positive_feedback: Array.isArray(parsed.positive_feedback) ? parsed.positive_feedback : [],
      };
    } catch (e) {
      console.error("Parse error:", e, "content:", content);
      // Fallback — return empty errors but positive feedback
      result = {
        errors: [],
        style_suggestions: [],
        positive_feedback: [{
          segment: transcript.slice(0, 120),
          feedback: "Good effort! We had trouble parsing the analysis — try recording again.",
        }],
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Unhandled error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process request", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
