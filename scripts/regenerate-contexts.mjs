/**
 * One-time script to regenerate context for all vocabulary words
 * using the "Use in... Works well in..." format.
 *
 * Setup:
 *   1. Copy your Supabase service role key from:
 *      https://supabase.com/dashboard/project/wdtufbcrevlejvzcijku/settings/api
 *   2. Run:
 *      SUPABASE_SERVICE_KEY=your_key_here node scripts/regenerate-contexts.mjs
 *
 * The GROQ key is read from the same fallback used in the edge function.
 */

const SUPABASE_URL = 'https://wdtufbcrevlejvzcijku.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY || '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';

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌  Missing SUPABASE_SERVICE_KEY env var.');
  console.error('   Get it from: https://supabase.com/dashboard/project/wdtufbcrevlejvzcijku/settings/api');
  process.exit(1);
}

async function fetchAllWords() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/vocabulary?word_type=neq.sentence&is_archived=eq.false&select=id,word,definition`,
    {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    }
  );
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function generateContext(word, definition) {
  const prompt = `For the vocabulary word "${word}" (meaning: "${definition}"), write a context note.

Return ONLY a JSON object:
{
  "context": "Use in [domain/setting] to [purpose]. Works well in [register/tone]."
}

Rules:
- Exactly 2 sentences.
- First sentence starts with "Use in..." or a similar action verb explaining WHERE and WHY to use this word.
- Second sentence starts with "Works well in..." or describes the register/tone/formality.
- Keep it under 40 words total.
- Return ONLY the JSON object.`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 120,
      temperature: 0.3,
    }),
  });

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';
  const match = content.match(/\{[\s\S]*\}/);
  if (match) {
    const parsed = JSON.parse(match[0]);
    return parsed.context || null;
  }
  return null;
}

async function updateContext(id, context) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/vocabulary?id=eq.${id}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ context, updated_at: new Date().toISOString() }),
    }
  );
  if (!res.ok) throw new Error(`Update failed: ${res.status} ${await res.text()}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('Fetching all words...');
  const words = await fetchAllWords();
  console.log(`Found ${words.length} words to update.\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < words.length; i++) {
    const { id, word, definition } = words[i];
    process.stdout.write(`[${i + 1}/${words.length}] ${word}... `);

    try {
      const context = await generateContext(word, definition || '');
      if (context) {
        await updateContext(id, context);
        console.log(`✓ ${context.slice(0, 60)}...`);
        success++;
      } else {
        console.log('⚠ no context returned, skipped');
        failed++;
      }
    } catch (err) {
      console.log(`✗ error: ${err.message}`);
      failed++;
    }

    // 200ms delay between requests to avoid Groq rate limits
    if (i < words.length - 1) await sleep(200);
  }

  console.log(`\nDone. ${success} updated, ${failed} failed.`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
