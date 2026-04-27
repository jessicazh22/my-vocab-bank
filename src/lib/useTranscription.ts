import { useState, useRef, useCallback, useEffect } from 'react';

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

export interface UseTranscriptionReturn {
  transcript: string;        // live preview during recording, final after stop
  interimTranscript: string; // current unconfirmed word(s) from Web Speech API
  isListening: boolean;
  isTranscribing: boolean;
  supported: boolean;
  durationSec: number;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

async function transcribeViaEdge(blob: Blob, mimeType: string, lang: string): Promise<string> {
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
      body: JSON.stringify({ audioBase64, mimeType, language: lang }),
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
  const [transcript, setTranscript]           = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isListening, setIsListening]         = useState(false);
  const [isTranscribing, setIsTranscribing]   = useState(false);
  const [durationSec, setDurationSec]         = useState(0);

  // MediaRecorder — for final Whisper transcription
  const recorderRef    = useRef<MediaRecorder | null>(null);
  const streamRef      = useRef<MediaStream | null>(null);
  const allChunksRef   = useRef<Blob[]>([]);
  const mimeTypeRef    = useRef('audio/webm');

  // Web Speech API — for live preview only (silently skipped if unavailable)
  const speechRef      = useRef<SpeechRecognition | null>(null);
  const liveTextRef    = useRef('');   // accumulated Web Speech API finals
  const isActiveRef    = useRef(false); // prevents stale-closure restarts

  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const lang           = locale.split('-')[0];

  const supported = typeof window !== 'undefined' && 'MediaRecorder' in window;

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  // ── Start Web Speech API for live preview ──────────────────────────────────
  const startSpeechRecognition = useCallback((loc: string) => {
    const SpeechImpl = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechImpl) return;

    const recog = new SpeechImpl();
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
          ? liveTextRef.current + ' ' + finalChunk.trim()
          : finalChunk.trim();
        setTranscript(liveTextRef.current);
      }
      setInterimTranscript(interim);
    };

    recog.onerror = () => {
      // Brave / Safari blocks this — silently ignore, MediaRecorder still runs
      speechRef.current = null;
      setInterimTranscript('');
    };

    recog.onend = () => {
      setInterimTranscript('');
      // Auto-restart after silence if still recording
      if (isActiveRef.current && speechRef.current) {
        try { recog.start(); } catch { /* already restarting */ }
      }
    };

    speechRef.current = recog;
    try { recog.start(); } catch { speechRef.current = null; }
  }, []);

  const start = useCallback(async () => {
    if (!supported) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation:  true,   // remove room echo
          noiseSuppression:  true,   // reduce background noise
          autoGainControl:   true,   // normalise volume levels
          sampleRate:        16000,  // Whisper's native rate — no resampling needed
          channelCount:      1,      // mono is sufficient, keeps file smaller
        },
      });
      streamRef.current    = stream;
      allChunksRef.current = [];
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
        if (e.data.size > 0) allChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        // Whisper gives the authoritative final transcript
        const blob = new Blob([...allChunksRef.current], { type: mimeTypeRef.current });
        const text = await transcribeViaEdge(blob, mimeTypeRef.current, lang);
        if (text) setTranscript(text);
        setIsTranscribing(false);
      };

      recorder.start(250);

      setTranscript('');
      setInterimTranscript('');
      setIsListening(true);
      setIsTranscribing(false);
      setDurationSec(0);
      timerRef.current = setInterval(() => setDurationSec(s => s + 1), 1000);

      // Attempt live preview — fails silently in Brave
      startSpeechRecognition(locale);

    } catch (e) {
      console.error('Could not start recording:', e);
    }
  }, [supported, lang, locale, startSpeechRecognition]);

  const stop = useCallback(() => {
    isActiveRef.current = false;

    // Stop live preview
    speechRef.current?.stop();
    speechRef.current = null;
    setInterimTranscript('');

    stopTimer();
    setIsTranscribing(true); // keep panel visible during async Whisper call
    setIsListening(false);
    recorderRef.current?.stop();
    recorderRef.current = null;
  }, [stopTimer]);

  const reset = useCallback(() => {
    isActiveRef.current = false;
    speechRef.current?.stop();
    speechRef.current = null;
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    recorderRef.current  = null;
    streamRef.current    = null;
    allChunksRef.current = [];
    liveTextRef.current  = '';
    stopTimer();
    setTranscript('');
    setInterimTranscript('');
    setIsListening(false);
    setIsTranscribing(false);
    setDurationSec(0);
  }, [stopTimer]);

  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      speechRef.current?.stop();
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach(t => t.stop());
      stopTimer();
    };
  }, [stopTimer]);

  return { transcript, interimTranscript, isListening, isTranscribing, supported, durationSec, start, stop, reset };
}
