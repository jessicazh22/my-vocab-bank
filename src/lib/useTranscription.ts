import { useState, useRef, useCallback, useEffect } from 'react';

const GROQ_API_KEY = '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';

// How often to send cumulative audio to Whisper while recording (ms)
const FLUSH_INTERVAL_MS = 8000;

export interface UseTranscriptionReturn {
  transcript: string;
  isListening: boolean;
  isTranscribing: boolean;
  supported: boolean;
  durationSec: number;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

async function whisper(blob: Blob, lang: string): Promise<string> {
  try {
    const form = new FormData();
    // Groq requires a filename with a supported extension
    form.append('file', blob, 'recording.webm');
    form.append('model', 'whisper-large-v3-turbo');
    form.append('language', lang);
    form.append('response_format', 'text');

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
      body: form,
    });

    if (!res.ok) {
      console.error('Whisper HTTP error', res.status, await res.text());
      return '';
    }
    return (await res.text()).trim();
  } catch (e) {
    console.error('Whisper fetch failed:', e);
    return '';
  }
}

export function useTranscription(locale: string = 'en-AU'): UseTranscriptionReturn {
  const [transcript, setTranscript]           = useState('');
  const [isListening, setIsListening]         = useState(false);
  const [isTranscribing, setIsTranscribing]   = useState(false);
  const [durationSec, setDurationSec]         = useState(0);

  const recorderRef   = useRef<MediaRecorder | null>(null);
  const streamRef     = useRef<MediaStream | null>(null);
  // ALL chunks from the start — needed because the webm header is only in chunk[0]
  const allChunksRef  = useRef<Blob[]>([]);
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mimeTypeRef   = useRef('audio/webm');
  const lang          = locale.split('-')[0]; // 'en'

  const supported =
    typeof window !== 'undefined' && 'MediaRecorder' in window;

  const stopTimers = useCallback(() => {
    if (timerRef.current)      { clearInterval(timerRef.current);      timerRef.current      = null; }
    if (flushTimerRef.current) { clearInterval(flushTimerRef.current); flushTimerRef.current = null; }
  }, []);

  // Sends ALL audio collected so far to Whisper and replaces the transcript.
  // Cumulative send solves the webm header problem — chunk[0] always included.
  const flushAll = useCallback(async () => {
    if (allChunksRef.current.length === 0) return;
    const blob = new Blob([...allChunksRef.current], { type: mimeTypeRef.current });
    const text = await whisper(blob, lang);
    if (text) setTranscript(text); // replace — Whisper re-transcribes the full audio
  }, [lang]);

  const start = useCallback(async () => {
    if (!supported) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current   = stream;
      allChunksRef.current = [];

      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg']
        .find(t => MediaRecorder.isTypeSupported(t)) ?? '';
      mimeTypeRef.current = mimeType || 'audio/webm';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) allChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        // Final flush — full audio, highest accuracy
        await flushAll();
        setIsTranscribing(false);
      };

      recorder.start(250); // small timeslice — chunks arrive quickly
      setIsListening(true);
      setIsTranscribing(false);
      setDurationSec(0); // ← reset timer for each new recording

      timerRef.current      = setInterval(() => setDurationSec(s => s + 1), 1000);
      flushTimerRef.current = setInterval(flushAll, FLUSH_INTERVAL_MS);

    } catch (e) {
      console.error('Could not start recording:', e);
    }
  }, [supported, flushAll]);

  const stop = useCallback(() => {
    stopTimers();
    // Set isTranscribing BEFORE isListening → false so the panel stays visible
    // while the final Whisper call runs (onstop is async)
    setIsTranscribing(true);
    setIsListening(false);
    recorderRef.current?.stop(); // triggers onstop async
    recorderRef.current = null;
  }, [stopTimers]);

  const reset = useCallback(() => {
    stopTimers();
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    recorderRef.current  = null;
    streamRef.current    = null;
    allChunksRef.current = [];
    setIsListening(false);
    setIsTranscribing(false);
    setTranscript('');
    setDurationSec(0);
  }, [stopTimers]);

  useEffect(() => {
    return () => {
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach(t => t.stop());
      stopTimers();
    };
  }, [stopTimers]);

  return { transcript, isListening, isTranscribing, supported, durationSec, start, stop, reset };
}
