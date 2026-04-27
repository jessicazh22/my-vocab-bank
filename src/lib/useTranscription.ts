import { useState, useRef, useCallback, useEffect } from 'react';

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Groq Whisper fallback — used when Deepgram WS fails
const FLUSH_INTERVAL_MS = 6000;

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

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

// ── Deepgram transcript message shape ─────────────────────────────────────────
interface DeepgramResult {
  type: string;
  channel?: {
    alternatives?: Array<{ transcript: string }>;
  };
  is_final?: boolean;
  speech_final?: boolean;
}

export function useTranscription(locale: string = 'en-AU'): UseTranscriptionReturn {
  const [transcript, setTranscript]             = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isListening, setIsListening]           = useState(false);
  const [isTranscribing, setIsTranscribing]     = useState(false);
  const [durationSec, setDurationSec]           = useState(0);

  // ── MediaRecorder ──────────────────────────────────────────────────────────
  const recorderRef   = useRef<MediaRecorder | null>(null);
  const streamRef     = useRef<MediaStream | null>(null);
  const allChunksRef  = useRef<Blob[]>([]);
  const headerChunk   = useRef<Blob | null>(null);
  const windowRef     = useRef<Blob[]>([]);
  const mimeTypeRef   = useRef('audio/webm');

  // ── Deepgram WebSocket ────────────────────────────────────────────────────
  const dgSocketRef   = useRef<WebSocket | null>(null);
  const committedRef  = useRef('');   // confirmed (is_final) Deepgram words
  const usingDGRef    = useRef(false); // true once DG WS successfully opens

  // ── Whisper fallback (for if DG fails) ────────────────────────────────────
  const prevTextRef   = useRef('');

  // ── Timers ─────────────────────────────────────────────────────────────────
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
    if (usingDGRef.current) return; // Deepgram is handling it
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

  // ── Connect Deepgram WebSocket ─────────────────────────────────────────────
  const connectDeepgram = useCallback(() => {
    // Build wss:// URL for the edge function
    const wsBase = SUPABASE_URL.replace(/^https?:\/\//, '');
    const wsUrl  = `wss://${wsBase}/functions/v1/deepgram-stream?lang=${lang}&apikey=${SUPABASE_ANON_KEY}`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch (e) {
      console.warn('Deepgram WS connect failed:', e);
      return;
    }

    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      usingDGRef.current = true;
      dgSocketRef.current = ws;
      // Stop Whisper flush timer — Deepgram is live
      if (flushTimerRef.current) { clearInterval(flushTimerRef.current); flushTimerRef.current = null; }
    };

    ws.onmessage = (event) => {
      if (!isActiveRef.current) return;
      try {
        const data = JSON.parse(event.data as string) as DeepgramResult;
        if (data.type !== 'Results') return;

        const alt     = data.channel?.alternatives?.[0];
        const text    = alt?.transcript ?? '';
        const isFinal = data.is_final ?? false;

        if (isFinal && text) {
          committedRef.current = committedRef.current
            ? `${committedRef.current} ${text.trim()}`
            : text.trim();
          setTranscript(committedRef.current);
          setInterimTranscript('');
        } else if (!isFinal && text) {
          setInterimTranscript(text.trim());
        }
      } catch { /* non-JSON heartbeat */ }
    };

    ws.onerror = () => {
      console.warn('Deepgram WS error — falling back to Whisper');
      usingDGRef.current  = false;
      dgSocketRef.current = null;
    };

    ws.onclose = () => {
      if (dgSocketRef.current === ws) {
        dgSocketRef.current = null;
      }
    };
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

        // Stream to Deepgram
        if (usingDGRef.current && dgSocketRef.current?.readyState === WebSocket.OPEN) {
          e.data.arrayBuffer().then(buf => {
            if (dgSocketRef.current?.readyState === WebSocket.OPEN) {
              dgSocketRef.current.send(buf);
            }
          });
        }
      };

      recorder.onstop = async () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;

        // Close Deepgram WS cleanly
        if (dgSocketRef.current) {
          try {
            dgSocketRef.current.send(JSON.stringify({ type: 'CloseStream' }));
            dgSocketRef.current.close();
          } catch { /* ignore */ }
          dgSocketRef.current = null;
        }

        // Final Whisper call — use as authoritative result (better accuracy than streaming)
        const blob = new Blob([...allChunksRef.current], { type: mimeTypeRef.current });
        const committedSoFar = committedRef.current;
        const text = await transcribeViaEdge(blob, mimeTypeRef.current, lang, committedSoFar);
        if (text) setTranscript(text);
        setIsTranscribing(false);
      };

      recorder.start(250); // 250ms chunks for low-latency streaming

      setTranscript('');
      setInterimTranscript('');
      setIsListening(true);
      setIsTranscribing(false);
      setDurationSec(0);

      timerRef.current = setInterval(() => setDurationSec(s => s + 1), 1000);

      // Start Deepgram — if it opens successfully, Whisper flush is suppressed
      connectDeepgram();

      // Whisper flush timer as fallback (no-op if Deepgram connects)
      flushTimerRef.current = setInterval(flushWindow, FLUSH_INTERVAL_MS);

    } catch (e) {
      console.error('Could not start recording:', e);
    }
  }, [supported, lang, flushWindow, connectDeepgram]);

  // ── stop ──────────────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    isActiveRef.current = false;
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

    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    recorderRef.current  = null;
    streamRef.current    = null;
    allChunksRef.current = [];
    windowRef.current    = [];
    headerChunk.current  = null;
    prevTextRef.current  = '';
    committedRef.current = '';
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
