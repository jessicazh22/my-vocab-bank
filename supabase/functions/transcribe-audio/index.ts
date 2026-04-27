import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { audioBase64, mimeType, language } = await req.json() as {
      audioBase64: string;
      mimeType: string;
      language: string;
    };

    if (!audioBase64) {
      return new Response(
        JSON.stringify({ error: "audioBase64 is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decode base64 → binary
    const binary = atob(audioBase64);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: mimeType ?? "audio/webm" });

    // Send to Groq Whisper
    // Prompt seeds Whisper with context so it capitalises properly, uses
    // punctuation, and doesn't hallucinate filler-word completions.
    const prompt =
      "This is a spoken English language-learning exercise. " +
      "The speaker is a non-native English speaker practising conversational or academic English. " +
      "Transcribe accurately with correct punctuation and capitalisation. " +
      "Preserve the speaker's words exactly — do not correct grammar.";

    const form = new FormData();
    form.append("file", blob, "recording.webm");
    form.append("model", "whisper-large-v3");   // full model — more accurate than turbo
    form.append("language", language ?? "en");
    form.append("response_format", "text");
    form.append("prompt", prompt);
    form.append("temperature", "0");             // deterministic output

    const groqRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
      body: form,
    });

    if (!groqRes.ok) {
      const err = await groqRes.text();
      console.error("Groq Whisper error:", err);
      return new Response(
        JSON.stringify({ error: "Transcription failed", details: err }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const transcript = (await groqRes.text()).trim();
    return new Response(
      JSON.stringify({ transcript }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unhandled error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process request", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
