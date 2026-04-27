import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const DEEPGRAM_API_KEY = Deno.env.get("DEEPGRAM_API_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (!DEEPGRAM_API_KEY) {
    return new Response(
      JSON.stringify({ error: "DEEPGRAM_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ key: DEEPGRAM_API_KEY }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
