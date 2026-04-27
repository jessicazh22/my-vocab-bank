import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const DEEPGRAM_API_KEY = Deno.env.get("DEEPGRAM_API_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, upgrade, connection",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Only accept WebSocket upgrades
  const upgrade = req.headers.get("upgrade") ?? "";
  if (upgrade.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket upgrade", { status: 426, headers: corsHeaders });
  }

  if (!DEEPGRAM_API_KEY) {
    return new Response("DEEPGRAM_API_KEY not configured", { status: 500, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const lang     = url.searchParams.get("lang")     ?? "en";
  const model    = url.searchParams.get("model")    ?? "nova-2-general";
  const encoding = url.searchParams.get("encoding") ?? "linear16";
  const sampleRate = url.searchParams.get("sample_rate") ?? "16000";

  // Upgrade client connection
  const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);

  // Open Deepgram WebSocket — auth via subprotocol token array
  const dgUrl = new URL("wss://api.deepgram.com/v1/listen");
  dgUrl.searchParams.set("model",        model);
  dgUrl.searchParams.set("language",     lang);
  dgUrl.searchParams.set("encoding",     encoding);
  dgUrl.searchParams.set("sample_rate",  sampleRate);
  dgUrl.searchParams.set("channels",     "1");
  dgUrl.searchParams.set("interim_results", "true");
  dgUrl.searchParams.set("smart_format", "true");
  dgUrl.searchParams.set("punctuate",    "true");
  dgUrl.searchParams.set("endpointing",  "300");

  const dgSocket = new WebSocket(dgUrl.toString(), ["token", DEEPGRAM_API_KEY]);
  dgSocket.binaryType = "arraybuffer";

  // Buffer audio sent before Deepgram is ready
  const audioQueue: (ArrayBuffer | string)[] = [];
  let dgReady = false;

  dgSocket.onopen = () => {
    dgReady = true;
    // Drain any buffered audio
    for (const chunk of audioQueue) {
      try { dgSocket.send(chunk); } catch { /* ignore */ }
    }
    audioQueue.length = 0;
  };

  dgSocket.onmessage = (event) => {
    // Forward Deepgram transcript events to client
    try {
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(event.data as string);
      }
    } catch { /* client may have disconnected */ }
  };

  dgSocket.onerror = (err) => {
    console.error("Deepgram WS error:", err);
    try { clientSocket.close(1011, "Deepgram connection error"); } catch { /* ignore */ }
  };

  dgSocket.onclose = (ev) => {
    try { clientSocket.close(ev.code, ev.reason); } catch { /* ignore */ }
  };

  // Forward audio from client → Deepgram
  clientSocket.onmessage = (event) => {
    const data = event.data;
    if (dgReady && dgSocket.readyState === WebSocket.OPEN) {
      try { dgSocket.send(data); } catch { /* ignore */ }
    } else {
      // Buffer until Deepgram is ready
      audioQueue.push(data as ArrayBuffer | string);
    }
  };

  clientSocket.onclose = () => {
    // Send close stream message to Deepgram, then close
    try {
      if (dgSocket.readyState === WebSocket.OPEN) {
        dgSocket.send(JSON.stringify({ type: "CloseStream" }));
        dgSocket.close();
      }
    } catch { /* ignore */ }
  };

  clientSocket.onerror = () => {
    try { dgSocket.close(); } catch { /* ignore */ }
  };

  return response;
});
