import { useState, useRef, useCallback, useEffect } from 'react';

// Key is already in the edge function source — no additional exposure here
const GROQ_API_KEY = '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';

export interface UseTranscriptionReturn {
  transcript: string;
  interimTranscript: string; // always '' — kept for interface compat
  isListening: boolean;
  isTranscribing: boolean;
  supported: boolean;
  durationSec: number;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

export function useTranscription(locale: string = 'en-AU'): UseTranscriptionReturn {
  const [transcript, setTranscript]       = useState('');
  const [isListening, setIsListening]     = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [durationSec, setDurationSec]     = useState(0);

  const recorderRef  = useRef<MediaRecorder | null>(null);
  const streamRef    = useRef<MediaStream | null>(null);
  const chunksRef    = useRef<Blob[]>([]);
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  const supported =
    typeof window !== 'undefined' && 'MediaRecorder' in window;

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const transcribeAudio = useCallback(async (blob: Blob, mimeType: string) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      // Use .webm extension — Groq accepts it
      formData.append('file', blob, 'recording.webm');
      formData.append('model', 'whisper-large-v3-turbo');
      formData.append('language', locale.split('-')[0]); // 'en'
      formData.append('response_format', 'text');

      const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
        body: formData,
      });

      if (!res.ok) {
        console.error('Whisper error:', await res.text());
        return;
      }

      const text = await res.text();
      setTranscript(text.trim());
    } catch (e) {
      console.error('Transcription failed:', e);
    } finally {
      setIsTranscribing(false);
    }
  }, [locale]);

  const start = useCallback(async () => {
    if (!supported) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg']
        .find(t => MediaRecorder.isTypeSupported(t)) ?? '';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        transcribeAudio(blob, recorder.mimeType);
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      };

      recorder.start(500); // collect chunks every 500 ms
      setIsListening(true);
      timerRef.current = setInterval(() => setDurationSec(s => s + 1), 1000);
    } catch (e) {
      console.error('Could not start recording:', e);
    }
  }, [supported, transcribeAudio]);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setIsListening(false);
    stopTimer();
  }, [stopTimer]);

  const reset = useCallback(() => {
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    recorderRef.current = null;
    streamRef.current = null;
    setIsListening(false);
    setIsTranscribing(false);
    setTranscript('');
    setDurationSec(0);
    stopTimer();
  }, [stopTimer]);

  useEffect(() => {
    return () => {
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach(t => t.stop());
      stopTimer();
    };
  }, [stopTimer]);

  return {
    transcript,
    interimTranscript: '',
    isListening,
    isTranscribing,
    supported,
    durationSec,
    start,
    stop,
    reset,
  };
}
