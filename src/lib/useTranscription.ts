import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseTranscriptionReturn {
  transcript: string;
  interimTranscript: string;
  isListening: boolean;
  supported: boolean;
  durationSec: number;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

export function useTranscription(locale: string = 'en-AU'): UseTranscriptionReturn {
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [durationSec, setDurationSec] = useState(0);

  // Refs so event-handler closures always read the latest value
  const activeRef      = useRef(false);   // true = we want to be recording
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);

  const supported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  // Creates and starts a fresh SpeechRecognition instance.
  // Called both on first start and on each auto-restart after silence.
  const spawnInstance = useCallback((currentLocale: string) => {
    if (!supported) return;

    const SpeechRecognitionImpl =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;

    const recognition = new SpeechRecognitionImpl();
    recognition.continuous      = true;
    recognition.interimResults  = true;
    recognition.lang            = currentLocale;
    recognitionRef.current      = recognition;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let finalChunk = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) finalChunk += r[0].transcript;
        else           interim    += r[0].transcript;
      }
      if (finalChunk) {
        setTranscript(prev =>
          prev ? prev + ' ' + finalChunk.trim() : finalChunk.trim()
        );
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech') return; // ignore — we'll auto-restart
      console.error('SpeechRecognition error:', event.error);
      activeRef.current = false;
      setIsListening(false);
      stopTimer();
    };

    // onend fires after each utterance / silence window.
    // If we still want to be recording, spawn a fresh instance immediately.
    recognition.onend = () => {
      setInterimTranscript('');
      if (activeRef.current) {
        // Small delay avoids a tight loop if the mic keeps failing
        setTimeout(() => {
          if (activeRef.current) spawnInstance(currentLocale);
        }, 100);
      }
    };

    try {
      recognition.start();
    } catch (e) {
      console.error('Could not start recognition:', e);
      activeRef.current = false;
      setIsListening(false);
      stopTimer();
    }
  }, [supported, stopTimer]);

  const start = useCallback(() => {
    if (!supported || activeRef.current) return;
    activeRef.current = true;
    setIsListening(true);
    timerRef.current = setInterval(() => setDurationSec(s => s + 1), 1000);
    spawnInstance(locale);
  }, [supported, locale, spawnInstance]);

  const stop = useCallback(() => {
    activeRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    setInterimTranscript('');
    stopTimer();
  }, [stopTimer]);

  const reset = useCallback(() => {
    stop();
    setTranscript('');
    setInterimTranscript('');
    setDurationSec(0);
  }, [stop]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      activeRef.current = false;
      recognitionRef.current?.stop();
      stopTimer();
    };
  }, [stopTimer]);

  return { transcript, interimTranscript, isListening, supported, durationSec, start, stop, reset };
}
