import { useState, useRef, useCallback, useEffect } from 'react';

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// How often to send a new window of audio to Whisper (Brave / non-Web-Speech browsers)
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
  const [transcript, setTranscript]             = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isListening, setIsListening]           = useState(false);
  const [isTranscribing, setIsTranscribing]     = useState(false);
  const [durationSec, setDurationSec]           = useState(0);

  // ── MediaRecorder ──────────────────────────────────────────────────────────
  const recorderRef   = useRef<MediaRecorder | null>(null);
  const streamRef     = useRef<MediaStream | null>(null);
  const allChunksRef  = useRef<Blob[]>([]);    // full recording, for final Whisper call
  const headerChunk   = useRef<Blob | null>(null); // first chunk = webm container header
  const windowRef     = useRef<Blob[]>([]);    // chunks in the current 6-second window
  const prevTextRef   = useRef('');            // accumulated Whisper text (for prompt context)
  const mimeTypeRef   = useRef('audio/webm');

  // ── Web Speech API (Chrome) ────────────────────────────────────────────────
  const speechRef     = useRef<SpeechRecognition | null>(null);
  const liveTextRef   = useRef('');            // accumulated Web Speech finals
  const isActiveRef   = useRef(false);

  // ── Timers ─────────────────────────────────────────────────────────────────
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const lang = locale.split('-')[0];

  const supported = typeof window !== 'undefined' && 'MediaRecorder' in window;

  const stopTimers = useCallback(() => {
    if (timerRef.current)      { clearInterval(timerRef.current);      timerRef.current      = null; }
    if (flushTimerRef.current) { clearInterval(flushTimerRef.current); flushTimerRef.current = null; }
  }, []);

  // ── Incremental Whisper flush (used when Web Speech API is unavailable) ────
  // Each window = [headerChunk] + [new audio chunks].
  // Prepending the header chunk gives Whisper a valid decodable webm file.
  // We APPEND to the transcript (not replace) so there's no garbling.
  const flushWindow = useCallback(async () => {
    // If Web Speech API is running, it's handling live display — skip Whisper flush
    if (speechRef.current) return;
    if (!headerChunk.current || windowRef.current.length === 0) return;

    const chunks = windowRef.current.splice(0); // grab + clear current window
    const blob   = new Blob([headerChunk.current, ...chunks], { type: mimeTypeRef.current });
    const text   = await transcribeViaEdge(blob, mimeTypeRef.current, lang, prevTextRef.current);

    if (text) {
      const full = prevTextRef.current ? `${prevTextRef.current} ${text}` : text;
      prevTextRef.current = full;
      setTranscript(full);
    }
  }, [lang]);

  // ── Web Speech API for live word-by-word preview (Chrome / Edge) ──────────
  const startSpeechRecognition = useCallback((loc: string) => {
    const SpeechImpl = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechImpl) return;

    const recog      = new SpeechImpl();
    recog.continuous     = true;
    recog.interimResults = true;
    recog.lang           = loc;

    recog.onresult = (event: SpeechRecognitionEvent) => {
      let finalChunk = '';
      let interim    = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalChunk += event.results[i][0].transcript;
        else                          interim    += event.results[i][0].transcript;
      }
      if (finalChunk) {
        liveTextRef.current = liveTextRef.current
          ? `${liveTextRef.current} ${finalChunk.trim()}`
          : finalChunk.trim();
        setTranscript(liveTextRef.current);
      }
      setInterimTranscript(interim);
    };

    recog.onerror = () => {
      // Brave / Safari — silently falls back to Whisper periodic flush
      speechRef.current = null;
      setInterimTranscript('');
    };

    recog.onend = () => {
      setInterimTranscript('');
      if (isActiveRef.current && speechRef.current) {
        try { recog.start(); } catch { /* already restarting */ }
      }
    };

    speechRef.current = recog;
    try { recog.start(); } catch { speechRef.current = null; }
  }, []);

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
      liveTextRef.current  = '';
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
        if (!headerChunk.current) {
          // First chunk contains the webm container header — store separately
          headerChunk.current = e.data;
        } else {
          windowRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        // Final full-audio Whisper call — most accurate result
        const blob = new Blob([...allChunksRef.current], { type: mimeTypeRef.current });
        const text = await transcribeViaEdge(blob, mimeTypeRef.current, lang, prevTextRef.current);
        if (text) setTranscript(text);
        setIsTranscribing(false);
      };

      recorder.start(250);
      setTranscript('');
      setInterimTranscript('');
      setIsListening(true);
      setIsTranscribing(false);
      setDurationSec(0);

      timerRef.current      = setInterval(() => setDurationSec(s => s + 1), 1000);
      // Periodic Whisper flush — kicks in if Web Speech API is unavailable (Brave)
      flushTimerRef.current = setInterval(flushWindow, FLUSH_INTERVAL_MS);

      // Attempt Web Speech API for word-by-word live preview (Chrome / Edge)
      startSpeechRecognition(locale);

    } catch (e) {
      console.error('Could not start recording:', e);
    }
  }, [supported, lang, locale, flushWindow, startSpeechRecognition]);

  // ── stop ──────────────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    isActiveRef.current = false;
    speechRef.current?.stop();
    speechRef.current = null;
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
    speechRef.current?.stop();
    speechRef.current = null;
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    recorderRef.current  = null;
    streamRef.current    = null;
    allChunksRef.current = [];
    windowRef.current    = [];
    headerChunk.current  = null;
    prevTextRef.current  = '';
    liveTextRef.current  = '';
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
      speechRef.current?.stop();
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach(t => t.stop());
      stopTimers();
    };
  }, [stopTimers]);

  return { transcript, interimTranscript, isListening, isTranscribing, supported, durationSec, start, stop, reset };
}
