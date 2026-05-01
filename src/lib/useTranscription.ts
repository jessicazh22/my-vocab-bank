import { useState, useRef, useCallback, useEffect } from 'react';

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Whisper fallback — fires every 6 s when Deepgram is unavailable
const FLUSH_INTERVAL_MS = 6000;

export interface UseTranscriptionReturn {
  transcript: string;
  interimTranscript: string;
  isListening: boolean;
  isTranscribing: boolean;
  supported: boolean;
  durationSec: number;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

// ── Whisper fallback (Groq) ────────────────────────────────────────────────────
async function transcribeViaEdge(
  blob: Blob,
  mimeType: string,
  lang: string,
  prevTranscript = '',
): Promise<string> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    bytes.forEach(b => (binary += String.fromCharCode(b)));
    const audioBase64 = btoa(binary);

    const res = await fetch(`${SUPABASE_URL}/functions/v1/transcribe-audio`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ audioBase64, mimeType, language: lang, prevTranscript }),
    });

    if (!res.ok) { console.error('transcribe-audio error:', res.status, await res.text()); return ''; }
    const { transcript } = (await res.json()) as { transcript: string };
    return transcript ?? '';
  } catch (e) {
    console.error('transcribeViaEdge failed:', e);
    return '';
  }
}

export function useTranscription(locale: string = 'en-AU'): UseTranscriptionReturn {
  const [transcript, setTranscript]               = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isListening, setIsListening]             = useState(false);
  const [isTranscribing, setIsTranscribing]       = useState(false);
  const [durationSec, setDurationSec]             = useState(0);

  // ── MediaRecorder ──────────────────────────────────────────────────────────
  const recorderRef  = useRef<MediaRecorder | null>(null);
  const streamRef    = useRef<MediaStream | null>(null);
  const allChunksRef = useRef<Blob[]>([]);
  const headerChunk  = useRef<Blob | null>(null);
  const windowRef    = useRef<Blob[]>([]);
  const mimeTypeRef  = useRef('audio/webm');

  // ── Deepgram WebSocket ────────────────────────────────────────────────────
  const dgSocketRef  = useRef<WebSocket | null>(null);
  const committedRef = useRef('');              // is_final words accumulated
  const interimRef   = useRef('');              // current non-final words (for UtteranceEnd)
  const usingDGRef   = useRef(false);           // true once DG WS opens successfully
  const dgQueueRef   = useRef<ArrayBuffer[]>([]); // audio buffered before WS open

  // ── Web Speech API (real-time display, no API key needed) ────────────────
  const recognitionRef  = useRef<SpeechRecognition | null>(null);
  const srCommittedRef  = useRef('');           // SR final results accumulated

  // ── Whisper fallback ──────────────────────────────────────────────────────
  const prevTextRef  = useRef('');

  // ── Timers / flags ─────────────────────────────────────────────────────────
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isActiveRef   = useRef(false);

  const lang = locale.split('-')[0];

  const supported = typeof window !== 'undefined' && 'MediaRecorder' in window;

  const stopTimers = useCallback(() => {
    if (timerRef.current)      { clearInterval(timerRef.current);      timerRef.current      = null; }
    if (flushTimerRef.current) { clearInterval(flushTimerRef.current); flushTimerRef.current = null; }
  }, []);

  // ── Whisper incremental flush (fallback when Deepgram unavailable) ─────────
  const flushWindow = useCallback(async () => {
    if (usingDGRef.current) return;
    if (!headerChunk.current || windowRef.current.length === 0) return;

    const chunks = windowRef.current.splice(0);
    const blob   = new Blob([headerChunk.current, ...chunks], { type: mimeTypeRef.current });
    const text   = await transcribeViaEdge(blob, mimeTypeRef.current, lang, prevTextRef.current);

    if (text) {
      const full = prevTextRef.current ? `${prevTextRef.current} ${text}` : text;
      prevTextRef.current = full;
      setTranscript(full);
    }
  }, [lang]);

  // ── Connect directly to Deepgram (no proxy) ───────────────────────────────
  // Fetch a short-lived key from the edge function, then open a WS straight to
  // api.deepgram.com. This is more reliable than a Supabase WS proxy because
  // Supabase's gateway doesn't always forward WebSocket upgrade requests.
  const connectDeepgram = useCallback(async () => {
    try {
      // Retrieve the Deepgram API key server-side so it's never in the bundle
      const keyRes = await fetch(`${SUPABASE_URL}/functions/v1/get-deepgram-key`, {
        headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      });
      if (!keyRes.ok) throw new Error(`Key fetch failed: ${keyRes.status}`);
      const { key } = await keyRes.json() as { key: string };

      // Build Deepgram streaming URL
      const dgUrl = new URL('wss://api.deepgram.com/v1/listen');
      dgUrl.searchParams.set('model',            'nova-2-general');
      dgUrl.searchParams.set('language',         lang);
      dgUrl.searchParams.set('interim_results',  'true');
      dgUrl.searchParams.set('utterance_end_ms', '1000'); // commit pending words after 1 s silence
      dgUrl.searchParams.set('smart_format',     'true');
      dgUrl.searchParams.set('punctuate',        'true');
      dgUrl.searchParams.set('endpointing',      '300');

      // Auth via WebSocket subprotocol — the Deepgram-supported way
      const ws = new WebSocket(dgUrl.toString(), ['token', key]);
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        usingDGRef.current  = true;
        dgSocketRef.current = ws;
        // Drain audio that arrived during the key-fetch + WS handshake
        // (includes the critical WebM container header)
        for (const buf of dgQueueRef.current) {
          try { ws.send(buf); } catch { /* ignore */ }
        }
        dgQueueRef.current = [];
        // Deepgram is live — kill the Whisper fallback timer
        if (flushTimerRef.current) { clearInterval(flushTimerRef.current); flushTimerRef.current = null; }
        // Stop Web Speech API — Deepgram owns transcription from here
        if (recognitionRef.current) {
          try { recognitionRef.current.stop(); } catch { /* ignore */ }
          recognitionRef.current = null;
        }
        // Seed Deepgram committed text with whatever SR captured so far
        if (srCommittedRef.current && !committedRef.current) {
          committedRef.current = srCommittedRef.current;
        }
        srCommittedRef.current = '';
      };

      ws.onmessage = (event) => {
        if (!isActiveRef.current) return;
        try {
          const data = JSON.parse(event.data as string) as {
            type: string;
            is_final?: boolean;
            channel?: { alternatives?: Array<{ transcript: string }> };
          };

          if (data.type === 'Results') {
            const text    = data.channel?.alternatives?.[0]?.transcript ?? '';
            const isFinal = data.is_final ?? false;

            if (isFinal && text) {
              // Confirmed words — append to committed transcript
              committedRef.current = committedRef.current
                ? `${committedRef.current} ${text.trim()}`
                : text.trim();
              interimRef.current = '';
              setTranscript(committedRef.current);
              setInterimTranscript('');
            } else if (!isFinal && text) {
              // Live preview — show as italic interim text
              interimRef.current = text.trim();
              setInterimTranscript(text.trim());
            }
          }

          if (data.type === 'UtteranceEnd') {
            // After 1 s of silence Deepgram fires UtteranceEnd. Any words still in
            // interimRef haven't been finalised — commit them now so nothing is lost.
            if (interimRef.current) {
              committedRef.current = committedRef.current
                ? `${committedRef.current} ${interimRef.current}`
                : interimRef.current;
              interimRef.current = '';
              setTranscript(committedRef.current);
              setInterimTranscript('');
            }
          }
        } catch { /* non-JSON heartbeat — ignore */ }
      };

      ws.onerror = () => {
        console.warn('Deepgram WS error — Whisper fallback active');
        usingDGRef.current  = false;
        dgSocketRef.current = null;
      };

      ws.onclose = () => {
        if (dgSocketRef.current === ws) dgSocketRef.current = null;
      };

    } catch (e) {
      console.warn('Deepgram connect failed — Whisper fallback active:', e);
      // usingDGRef stays false → Whisper flush timer runs normally
    }
  }, [lang]);

  // ── start ─────────────────────────────────────────────────────────────────
  const start = useCallback(async () => {
    if (!supported) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl:  true,
          sampleRate:       16000,
          channelCount:     1,
        },
      });

      streamRef.current    = stream;
      allChunksRef.current = [];
      windowRef.current    = [];
      headerChunk.current  = null;
      prevTextRef.current  = '';
      committedRef.current = '';
      interimRef.current   = '';
      dgQueueRef.current   = [];
      usingDGRef.current   = false;
      isActiveRef.current  = true;

      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg']
        .find(t => MediaRecorder.isTypeSupported(t)) ?? '';
      mimeTypeRef.current = mimeType || 'audio/webm';

      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType, audioBitsPerSecond: 128_000 } : undefined,
      );
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size <= 0) return;
        allChunksRef.current.push(e.data);

        // Whisper fallback bookkeeping
        if (!headerChunk.current) {
          headerChunk.current = e.data;
        } else {
          windowRef.current.push(e.data);
        }

        // Stream to Deepgram, or buffer if WS not yet open
        e.data.arrayBuffer().then(buf => {
          if (dgSocketRef.current?.readyState === WebSocket.OPEN) {
            dgSocketRef.current.send(buf);
          } else if (!usingDGRef.current) {
            // Still connecting (or key fetch in progress) — queue so the WebM
            // container header and early audio aren't dropped
            dgQueueRef.current.push(buf);
          }
        });
      };

      recorder.onstop = async () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;

        // Close Deepgram cleanly
        if (dgSocketRef.current) {
          try {
            dgSocketRef.current.send(JSON.stringify({ type: 'CloseStream' }));
            dgSocketRef.current.close();
          } catch { /* ignore */ }
          dgSocketRef.current = null;
        }

        // Final Whisper call — full audio, no prompt bias, authoritative result.
        // Do NOT pass committed Deepgram text as prompt: Whisper treats the prompt
        // as "already transcribed" and skips the beginning of the audio.
        const blob = new Blob([...allChunksRef.current], { type: mimeTypeRef.current });
        const text = await transcribeViaEdge(blob, mimeTypeRef.current, lang, '');
        // Use Whisper if successful; else keep the Deepgram accumulated result
        const finalText = text || committedRef.current;
        if (finalText) setTranscript(finalText);
        setIsTranscribing(false);
      };

      recorder.start(250);

      // ── Web Speech API — real-time display fallback ──────────────────────
      // Starts immediately with no API key. Results are shown until Deepgram
      // takes over, at which point SR results are silently ignored.
      const SpeechRec =
        (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition })
          .SpeechRecognition ??
        (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition })
          .webkitSpeechRecognition;

      if (SpeechRec) {
        const rec = new SpeechRec();
        rec.continuous     = true;
        rec.interimResults = true;
        rec.lang           = locale;
        srCommittedRef.current = '';

        rec.onresult = (event: SpeechRecognitionEvent) => {
          // Once Deepgram is live, let it own the transcript state
          if (usingDGRef.current || !isActiveRef.current) return;
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            if (result.isFinal) {
              const t = result[0].transcript.trim();
              srCommittedRef.current = srCommittedRef.current ? `${srCommittedRef.current} ${t}` : t;
            } else {
              interim += result[0].transcript;
            }
          }
          setTranscript(srCommittedRef.current);
          setInterimTranscript(interim.trim());
        };

        rec.onerror = (e: SpeechRecognitionErrorEvent) => {
          // 'no-speech' fires when there's silence — not a real error
          if (e.error !== 'no-speech') console.warn('SpeechRecognition error:', e.error);
        };

        rec.onend = () => {
          // Auto-restart if still recording and Deepgram hasn't taken over
          if (isActiveRef.current && !usingDGRef.current && recognitionRef.current === rec) {
            try { rec.start(); } catch { /* already stopped */ }
          }
        };

        try { rec.start(); } catch (e) { console.warn('SpeechRecognition start failed:', e); }
        recognitionRef.current = rec;
      }

      setTranscript('');
      setInterimTranscript('');
      setIsListening(true);
      setIsTranscribing(false);
      setDurationSec(0);

      timerRef.current = setInterval(() => setDurationSec(s => s + 1), 1000);

      // Connect to Deepgram directly. While the key-fetch + handshake is in
      // progress (typically <300 ms) audio is buffered in dgQueueRef.
      connectDeepgram();

      // Whisper flush timer — suppressed automatically once Deepgram opens
      flushTimerRef.current = setInterval(flushWindow, FLUSH_INTERVAL_MS);

    } catch (e) {
      console.error('Could not start recording:', e);
    }
  }, [supported, lang, flushWindow, connectDeepgram]);

  // ── stop ──────────────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    isActiveRef.current = false;
    // Stop Web Speech API
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    srCommittedRef.current = '';
    setInterimTranscript('');
    stopTimers();
    setIsTranscribing(true);
    setIsListening(false);
    recorderRef.current?.stop();
    recorderRef.current = null;
  }, [stopTimers]);

  // ── reset ─────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    isActiveRef.current = false;

    if (dgSocketRef.current) {
      try {
        dgSocketRef.current.send(JSON.stringify({ type: 'CloseStream' }));
        dgSocketRef.current.close();
      } catch { /* ignore */ }
      dgSocketRef.current = null;
    }

    // Stop Web Speech API
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    srCommittedRef.current = '';
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    recorderRef.current  = null;
    streamRef.current    = null;
    allChunksRef.current = [];
    windowRef.current    = [];
    headerChunk.current  = null;
    prevTextRef.current  = '';
    committedRef.current = '';
    interimRef.current   = '';
    dgQueueRef.current   = [];
    usingDGRef.current   = false;
    stopTimers();
    setTranscript('');
    setInterimTranscript('');
    setIsListening(false);
    setIsTranscribing(false);
    setDurationSec(0);
  }, [stopTimers]);

  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { /* ignore */ }
        recognitionRef.current = null;
      }
      if (dgSocketRef.current) {
        try { dgSocketRef.current.close(); } catch { /* ignore */ }
        dgSocketRef.current = null;
      }
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach(t => t.stop());
      stopTimers();
    };
  }, [stopTimers]);

  return { transcript, interimTranscript, isListening, isTranscribing, supported, durationSec, start, stop, reset };
}
