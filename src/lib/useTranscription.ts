import { useState, useRef, useCallback, useEffect } from 'react';

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;


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

async function transcribeViaEdge(blob: Blob, mimeType: string, lang: string): Promise<string> {
  try {
    // Convert blob → base64
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    bytes.forEach(b => binary += String.fromCharCode(b));
    const audioBase64 = btoa(binary);

    const res = await fetch(`${SUPABASE_URL}/functions/v1/transcribe-audio`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ audioBase64, mimeType, language: lang }),
    });

    if (!res.ok) {
      console.error('transcribe-audio error:', res.status, await res.text());
      return '';
    }

    const { transcript } = await res.json() as { transcript: string };
    return transcript ?? '';
  } catch (e) {
    console.error('transcribeViaEdge failed:', e);
    return '';
  }
}

export function useTranscription(locale: string = 'en-AU'): UseTranscriptionReturn {
  const [transcript, setTranscript]         = useState('');
  const [isListening, setIsListening]       = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [durationSec, setDurationSec]       = useState(0);

  const recorderRef  = useRef<MediaRecorder | null>(null);
  const streamRef    = useRef<MediaStream | null>(null);
  const allChunksRef = useRef<Blob[]>([]);   // cumulative — webm header always in chunk[0]
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const mimeTypeRef  = useRef('audio/webm');
  const lang         = locale.split('-')[0]; // 'en'

  const supported =
    typeof window !== 'undefined' && 'MediaRecorder' in window;

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const flushAll = useCallback(async () => {
    if (allChunksRef.current.length === 0) return;
    const blob = new Blob([...allChunksRef.current], { type: mimeTypeRef.current });
    const text = await transcribeViaEdge(blob, mimeTypeRef.current, lang);
    if (text) setTranscript(text);
  }, [lang]);

  const start = useCallback(async () => {
    if (!supported) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current    = stream;
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
        await flushAll(); // final full-audio transcription
        setIsTranscribing(false);
      };

      recorder.start(250);
      setIsListening(true);
      setIsTranscribing(false);
      setDurationSec(0);

      timerRef.current = setInterval(() => setDurationSec(s => s + 1), 1000);

    } catch (e) {
      console.error('Could not start recording:', e);
    }
  }, [supported, flushAll]);

  const stop = useCallback(() => {
    stopTimer();
    setIsTranscribing(true); // keep panel visible while onstop runs async
    setIsListening(false);
    recorderRef.current?.stop();
    recorderRef.current = null;
  }, [stopTimer]);

  const reset = useCallback(() => {
    stopTimer();
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    recorderRef.current  = null;
    streamRef.current    = null;
    allChunksRef.current = [];
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
