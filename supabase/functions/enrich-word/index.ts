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
  multipleChoiceOnly?: boolean;
  locale?: string; // 'en-AU' | 'en-US'
  context?: string;
  previousSentences?: string[];
  targetCollocation?: { phrase: string; note?: string };
  distinctionOnly?: boolean;
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
    const { word, definition, sentence, mode, scaffoldOnly, defineOnly, shortPhraseOnly, multipleChoiceOnly, locale, context, previousSentences, targetCollocation, distinctionOnly }: RequestPayload = await req.json();
    const isAustralian = locale === 'en-AU' || locale == null; // default to AU
    const spellingNote = isAustralian
      ? `IMPORTANT: Use Australian/British English spelling conventions. Words ending in "-ise", "-our", "-re", "-ogue" (e.g. "commoditised", "organise", "colour", "theatre", "catalogue") are CORRECT spellings — do NOT flag them as misspellings. Only flag something as a misspelling if it is genuinely a typo or an unknown word regardless of variant.`
      : `IMPORTANT: Use American English spelling conventions. Words ending in "-ize", "-or", "-er", "-og" (e.g. "commoditized", "organize", "color", "theater", "catalog") are CORRECT spellings.`;

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
          const def = parsed.definition as string | undefined;
          const lowercasedDef = def ? def.charAt(0).toLowerCase() + def.slice(1) : def;
          return new Response(JSON.stringify({ definition: lowercasedDef }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch { /* fall through */ }
      return new Response(JSON.stringify({ error: "Could not generate short definition" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Multiple choice mode — 3 sentences at different quality levels for recognition practice
    if (multipleChoiceOnly) {
      const mcPrompt = `Write 3 sentences using the word "${word}"${definition ? ` (meaning: "${definition}")` : ''}.

The question shown to the learner will be: "Which sentence uses '${word}' most accurately?"

Rules:
- The word MUST appear in every sentence.
- Write like a good author who simply needed the word — not like someone constructing an example to teach it. The word appears because it's the right one, not because the sentence was built around it.
- One "best" sentence: precise and natural — the word earns its place because a simpler synonym would lose something specific. The sentence should feel like it could come from a novel or essay. Something in the word's particular register or nuance should be evident.
  Examples of the right register:
  "She was reticent in a way that felt deliberate — answering only what was asked, never once volunteering."
  "He remained sanguine about the diagnosis in a way that unnerved the doctors more than despair would have."
  "She was fastidious about sound — a dripping tap three rooms away was enough to keep her up."
- One "ok" sentence: grammatically correct, word used validly, but generic — a simpler synonym (honest, fleeting, thorough) would do the same job with no loss.
- One "weak/wrong" sentence: either a common misuse (wrong word — e.g. reticent where 'reluctant' belongs, disinterested where 'uninterested' belongs) OR the word applied to a context that doesn't fit (e.g. sanguine describing a room's atmosphere rather than a person's disposition).

The best sentence should NOT always be the longest. No over-written prose. No fake attributions.
Randomise the order — bestIndex must not always be 0.

Return ONLY a JSON object:
{"options": ["sentence 1", "sentence 2", "sentence 3"], "bestIndex": 0, "reason": "one crisp phrase under 12 words — what makes the best one earn the word"}`;

      const mcResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "user", content: mcPrompt }],
          max_tokens: 400,
          temperature: 0.7,
        }),
      });
      const mcData = await mcResponse.json();
      const mcContent = mcData.choices?.[0]?.message?.content || "";
      try {
        const jsonMatch = mcContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed.options) && parsed.options.length === 3 && typeof parsed.bestIndex === 'number') {
            return new Response(JSON.stringify({
              options: parsed.options,
              bestIndex: parsed.bestIndex,
              reason: parsed.reason ?? '',
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        }
      } catch { /* fall through */ }
      return new Response(JSON.stringify({ error: "Could not generate multiple choice options" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Distinction-only mode — regenerate just the distinction note for a word
    if (distinctionOnly) {
      const distinctionPrompt = `For the word/phrase "${word}"${definition ? ` (meaning: "${definition}")` : ''}, generate a distinction note if applicable.

Only include if a learner would plausibly reach for a different word by mistake. Pick ONE near-synonym — the most likely confusion. Write 2–4 short, concrete sentences. Make the reader feel the difference through a scenario or example phrase, not just a definition. Start by contrasting the two (can use "Word = X. Synonym = Y." pattern), then show where the difference actually matters, optionally end with a natural example phrase in quotes.

Examples of the target quality:
- "Optimistic = hopeful things will go well. Sanguine = staying calmly confident when they might not. The difference shows under pressure — an optimist hopes for the best; a sanguine person remains composed even as things get harder. 'Cautiously sanguine' only makes sense because the difficulty is already there."
- "Honest people don't lie. A person with candour says what others in the room are thinking but won't say. Honesty is the baseline; candour is saying it plainly when everyone else is hedging. 'She spoke with refreshing candour' — meaning she didn't soften it."
- "Apparent = what you can see. Ostensible = the official story — with the implication that the real reason is something else. If you use ostensible, you're being slightly suspicious. 'His ostensible reason for leaving early was a doctor's appointment.'"

Do NOT list more than one synonym. Set to null if there's no single confusable near-synonym.

Return ONLY a JSON object: {"distinction": "your note here"} or {"distinction": null}`;

      const distResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "user", content: distinctionPrompt }],
          max_tokens: 300,
          temperature: 0.3,
        }),
      });
      const distData = await distResponse.json();
      const distContent = distData.choices?.[0]?.message?.content || "";
      try {
        const jsonMatch = distContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return new Response(JSON.stringify({ distinction: parsed.distinction ?? null }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch { /* fall through */ }
      return new Response(JSON.stringify({ distinction: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Quick define mode — short definition + examples + context for a word with no definition
    if (defineOnly) {
      const definePrompt = `For the word "${word}", provide a short definition and learning content.

${spellingNote}

Return ONLY a JSON object:
{
  "correction": null,
  "definition": "Very short 3-8 word simple definition in lowercase. Examples: 'concise and packed with meaning' or 'winding in curves or bends'. No full sentences, no 'means that'. Just a simple, direct phrase.",
  "examples": ["example 1", "example 2", "example 3"],
  "context": "Use in [domain/setting] to [purpose]. Works well in [register/tone].",
  "collocations": { "pairs": [{ "phrase": "...", "note": "..." }], "summary": "..." },
  "distinction": "1-2 sentences explaining how this word differs from its near-synonyms, or null",
  "scaffoldPrompt": "A short practice prompt (1-2 sentences, under 35 words)."
}

Rules:
- correction: apply the spelling convention above. If "${word}" is a genuine typo/unknown word, set to the correct spelling. If it is a valid word in the specified English variant, set to null.
- definition: 3-8 words, all lowercase, no capitals at start
- examples: exactly 3 full, properly capitalised sentences ending with a period. Each should show the word used naturally in a distinct context. NOT short fragments — write complete sentences like "Despite the setbacks, she remained sanguine about the outcome."
- context: exactly 2 sentences. First starts with "Use in..." or similar action verb. Second starts with "Works well in..." or describes the register/tone.
- collocations.pairs: 4-6 objects showing how "${word}" naturally combines with other words. CRITICAL: every "phrase" must contain the word "${word}" itself — no thematic descriptions or associations. Each object has "phrase" (e.g. "remain sanguine", "cautiously sanguine", "sanguine about the outcome / prospects") and optional "note" (a short phrase — NOT a full sentence — only when it adds real nuance about frequency, register, or a subtle meaning shift; omit note entirely when self-evident). Example pairs for "sanguine": [{"phrase":"remain sanguine","note":"the most common pairing; implies holding optimism under pressure"},{"phrase":"cautiously sanguine","note":"hedged optimism, common in business and finance"},{"phrase":"sanguine about the outcome / prospects"}]
- collocations.summary: 1-2 sentences drawing out the pattern across the set (e.g. which verb forms dominate, what the adverb pairings signal to listeners).
- distinction: only include if a learner would plausibly reach for a different word by mistake. Pick ONE near-synonym — the most likely confusion. Write 2–4 short, concrete sentences. Make the reader feel the difference through a scenario or example phrase, not just a definition. Start by contrasting the two (can use "Word = X. Synonym = Y." pattern), then show where the difference actually matters, optionally end with a natural example phrase in quotes. Examples of the target quality: "Optimistic = hopeful things will go well. Sanguine = staying calmly confident when they might not. The difference shows under pressure — an optimist hopes for the best; a sanguine person remains composed even as things get harder. 'Cautiously sanguine' only makes sense because the difficulty is already there." or "Apparent = what you can see. Ostensible = the official story — with the implication that the real reason is something else. If you use ostensible, you're being slightly suspicious. 'His ostensible reason for leaving early was a doctor's appointment.'" Do NOT list more than one synonym. Set to null if there's no single confusable near-synonym.
- scaffoldPrompt: name 2-3 specific domains from the context where this word works naturally, then give a specific invitation. Format: "${word} works best describing [domain1], [domain2], or [domain3]. Can you use it in a sentence about [specific grounded example from everyday life]?" No hypotheticals, no movie references.
- Return ONLY the JSON object, no other text`;

      const defineResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "user", content: definePrompt }],
          max_tokens: 1200,
          temperature: 0.3,
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
            parsed.definition = parsed.definition.charAt(0).toLowerCase() + parsed.definition.slice(1);
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

    // Build scaffold prompt instruction based on whether the learner has prior sentences
    const hasPriorSentences = previousSentences && previousSentences.length > 0;
    const contextNote = context ? `The word's main contexts: "${context}"` : '';

    const scaffoldInstruction = hasPriorSentences
      ? `The learner is practicing the word "${word}" (meaning: "${definition}").
${contextNote}
Their previous practice sentences:
${previousSentences!.map((s, i) => `${i + 1}. "${s}"`).join('\n')}

Generate a short follow-up prompt (1-2 sentences, under 40 words) that:
- Briefly notes the context they last tried (without quoting their sentence directly)
- Guides them toward a different domain from the context they haven't covered yet
- If they appear to have covered all the main contexts, ask them to write the sentence that would feel most natural coming out of their mouth in real life — no domain constraint

Example formats:
"Last time you used it for something in nature. Can you use ${word} this time to describe a cultural moment or trend — something in business, media, or technology that felt short-lived?"
OR (if all contexts seem covered): "You've tried ${word} across its main contexts. Write the sentence that would most naturally come out of your mouth in real life."
Return ONLY: {"scaffoldPrompt": "..."}`
      : `Generate a short practice prompt (1-2 sentences, under 35 words) for the word "${word}" (meaning: "${definition}").
${contextNote}
Name 2-3 specific domains where this word fits naturally, then give a grounded invitation to use it there.
Format: "${word} works best describing [domain1], [domain2], or [domain3]. Can you use it in a sentence about [specific everyday example]?"
No hypotheticals, no movie references, no abstract scenarios.
Return ONLY: {"scaffoldPrompt": "..."}`;

    if (scaffoldOnly && targetCollocation) {
      const collocationPrompt = `Generate a short practice prompt (2-3 sentences, under 50 words) for a learner who wants to practice the word "${word}" using specifically the pairing "${targetCollocation.phrase}".
${targetCollocation.note ? `About this pairing: ${targetCollocation.note}.` : ''}
${context ? `The word's broader contexts: "${context}"` : ''}

The prompt should:
1. Briefly explain what makes this specific pairing natural or distinct — don't just repeat the note, expand how it sounds in real use
2. Give a specific, grounded invitation to write a sentence using exactly that pairing

Example for "remain sanguine" with note "implies holding optimism under pressure":
"'Remain sanguine' is the most natural form — it implies actively holding your optimism despite real pressure. Can you write a sentence where someone (or you) remained sanguine in a genuinely difficult moment?"

Return ONLY: {"scaffoldPrompt": "..."}`;

      const collocationResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "user", content: collocationPrompt }],
          max_tokens: 150,
          temperature: 0.7,
        }),
      });
      const collocationData = await collocationResponse.json();
      const collocationContent = collocationData.choices?.[0]?.message?.content || "";
      try {
        const jsonMatch = collocationContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return new Response(JSON.stringify(parsed), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch { /* fall through to regular scaffold */ }
    }

    if (scaffoldOnly) {
      const scaffoldPrompt = scaffoldInstruction;

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
      // Try JSON parse first
      try {
        const jsonMatch = scaffoldContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.scaffoldPrompt) {
            return new Response(JSON.stringify(parsed), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      } catch { /* fall through */ }
      // If the model returned raw text instead of JSON, use it directly as the prompt
      if (scaffoldContent.trim().length > 15) {
        return new Response(JSON.stringify({ scaffoldPrompt: scaffoldContent.trim() }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Last resort: generate a minimal but useful scaffold
      return new Response(JSON.stringify({
        scaffoldPrompt: `"${word}" tends to appear in precise, considered writing. Can you use it in a sentence about something specific from your own experience?`
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const systemPrompt = `You are a vocabulary enrichment assistant. Given a word and its definition, generate helpful learning content.

Return a JSON object with exactly this structure:
{
  "examples": ["example 1", "example 2", "example 3"],
  "context": "Use in X, Y, or Z contexts to describe/praise/criticize [specific use]. Works well in [setting].",
  "collocations": { "pairs": [{ "phrase": "...", "note": "..." }], "summary": "..." },
  "distinction": "1-2 sentences explaining how this word differs from its near-synonyms, or null",
  "scaffoldPrompt": "A practice prompt to help the learner use this word"
}

Guidelines:
- Provide exactly 3 diverse example sentences that clearly demonstrate the word's meaning
- Examples should be natural, memorable, properly capitalised full sentences ending with a period
- Context should be 2 sentences max. First sentence starts with an action verb like "Use in..." explaining WHERE and WHY. Second sentence describes the setting or tone.
- collocations.pairs: 4-6 objects showing how the word naturally combines with other words. CRITICAL: every "phrase" must contain the word itself — no thematic descriptions or associations. Each has "phrase" (the natural collocation, e.g. "remain sanguine", "cautiously sanguine", "sanguine about the outcome / prospects") and optional "note" (short phrase only — omit when self-evident; include when it signals frequency, register, or a subtle shift). Example: [{"phrase":"remain sanguine","note":"the most common pairing; implies holding optimism under pressure"},{"phrase":"cautiously sanguine","note":"hedged optimism, common in business and finance"},{"phrase":"sanguine about the outcome / prospects"}]
- collocations.summary: 1-2 sentences observing the pattern across the set (e.g. which verb forms dominate, what adverb pairings signal to listeners).
- distinction: only include if a learner would plausibly reach for a different word by mistake. Pick ONE near-synonym — the most likely confusion. Write 2–4 short, concrete sentences. Make the reader feel the difference through a scenario or example phrase, not just a definition. Start by contrasting the two (can use "Word = X. Synonym = Y." pattern), then show where the difference actually matters, optionally end with a natural example phrase in quotes. Examples of the target quality: "Optimistic = hopeful things will go well. Sanguine = staying calmly confident when they might not. The difference shows under pressure — an optimist hopes for the best; a sanguine person remains composed even as things get harder. 'Cautiously sanguine' only makes sense because the difficulty is already there." or "Apparent = what you can see. Ostensible = the official story — with the implication that the real reason is something else. If you use ostensible, you're being slightly suspicious. 'His ostensible reason for leaving early was a doctor's appointment.'" Do NOT list more than one synonym. Set to null if there's no single confusable near-synonym.
- scaffoldPrompt: 1-2 sentences, under 35 words. Name 2-3 specific domains from the context where this word works naturally, then give a grounded invitation. Format: "[word] works best describing [domain1], [domain2], or [domain3]. Can you use it in a sentence about [specific everyday example]?" No hypotheticals, no movie references.
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
        max_tokens: 700,
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
        examples: [],
        context: "",
        scaffoldPrompt: `Can you use "${word}" in a sentence that shows its precise meaning?`,
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
