import { useState, useRef, useCallback, useEffect } from 'react';

const GROQ_API_KEY = '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';

// How often to flush a chunk to Whisper while recording (ms)
const CHUNK_INTERVAL_MS = 6000;

export interface UseTranscriptionReturn {
  transcript: string;
  isListening: boolean;
  isTranscribing: boolean; // true only during final cleanup transcription
  supported: boolean;
  durationSec: number;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

async function whisper(blob: Blob, lang: string): Promise<string> {
  const form = new FormData();
  form.append('file', blob, 'chunk.webm');
  form.append('model', 'whisper-large-v3-turbo');
  form.append('language', lang);
  form.append('response_format', 'text');

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
    body: form,
  });

  if (!res.ok) { console.error('Whisper error:', await res.text()); return ''; }
  return (await res.text()).trim();
}

export function useTranscription(locale: string = 'en-AU'): UseTranscriptionReturn {
  const [transcript, setTranscript]         = useState('');
  const [isListening, setIsListening]       = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [durationSec, setDurationSec]       = useState(0);

  const recorderRef    = useRef<MediaRecorder | null>(null);
  const streamRef      = useRef<MediaStream | null>(null);
  const allChunksRef   = useRef<Blob[]>([]);   // every chunk — for final fallback
  const windowRef      = useRef<Blob[]>([]);   // current 6-second window
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunkTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const mimeTypeRef    = useRef('audio/webm');
  const langRef        = useRef(locale.split('-')[0]);

  const supported =
    typeof window !== 'undefined' && 'MediaRecorder' in window;

  const stopTimer = useCallback(() => {
    if (timerRef.current)      { clearInterval(timerRef.current);      timerRef.current      = null; }
    if (chunkTimerRef.current) { clearInterval(chunkTimerRef.current); chunkTimerRef.current = null; }
  }, []);

  // Flush the current window to Whisper and append result to transcript
  const flushWindow = useCallback(async () => {
    const chunks = windowRef.current.splice(0); // take + clear
    if (chunks.length === 0) return;
    const blob = new Blob(chunks, { type: mimeTypeRef.current });
    const text = await whisper(blob, langRef.current);
    if (text) setTranscript(prev => prev ? prev + ' ' + text : text);
  }, []);

  const start = useCallback(async () => {
    if (!supported) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current  = stream;
      allChunksRef.current = [];
      windowRef.current    = [];

      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg']
        .find(t => MediaRecorder.isTypeSupported(t)) ?? '';
      mimeTypeRef.current = mimeType || 'audio/webm';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          allChunksRef.current.push(e.data);
          windowRef.current.push(e.data);
        }
      };

      // Final transcription on stop — flush any remaining window chunk
      recorder.onstop = async () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        // Flush leftover audio that didn't make it into the last interval
        const remaining = windowRef.current.splice(0);
        if (remaining.length > 0) {
          setIsTranscribing(true);
          const blob = new Blob(remaining, { type: mimeTypeRef.current });
          const text = await whisper(blob, langRef.current);
          if (text) setTranscript(prev => prev ? prev + ' ' + text : text);
          setIsTranscribing(false);
        }
      };

      recorder.start(200); // small timeslice so we get data quickly
      setIsListening(true);

      // Duration counter
      timerRef.current = setInterval(() => setDurationSec(s => s + 1), 1000);

      // Periodic flush every CHUNK_INTERVAL_MS
      chunkTimerRef.current = setInterval(flushWindow, CHUNK_INTERVAL_MS);

    } catch (e) {
      console.error('Could not start recording:', e);
    }
  }, [supported, flushWindow]);

  const stop = useCallback(() => {
    stopTimer();
    recorderRef.current?.stop(); // triggers onstop → flushes remainder
    recorderRef.current = null;
    setIsListening(false);
  }, [stopTimer]);

  const reset = useCallback(() => {
    stopTimer();
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    recorderRef.current = null;
    streamRef.current   = null;
    allChunksRef.current = [];
    windowRef.current    = [];
    setIsListening(false);
    setIsTranscribing(false);
    setTranscript('');
    setDurationSec(0);
  }, [stopTimer]);

  useEffect(() => {
    return () => {
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach(t => t.stop());
      stopTimer();
    };
  }, [stopTimer]);

  return { transcript, isListening, isTranscribing, supported, durationSec, start, stop, reset };
}
