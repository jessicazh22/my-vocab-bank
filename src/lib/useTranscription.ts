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

// Augment window type for webkit prefix
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

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRef = useRef(''); // keep stable ref for onresult closure
  const isListeningRef = useRef(false);

  const supported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // Keep ref in sync so the onresult handler always sees the latest value
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    isListeningRef.current = false;
    recognitionRef.current?.stop();
    setIsListening(false);
    setInterimTranscript('');
    stopTimer();
  }, [stopTimer]);

  const start = useCallback(() => {
    if (!supported) return;

    const SpeechRecognitionImpl =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;

    const recognition = new SpeechRecognitionImpl();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = locale;

    recognition.onstart = () => {
      isListeningRef.current = true;
      setIsListening(true);
      timerRef.current = setInterval(() => {
        setDurationSec(s => s + 1);
      }, 1000);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let newFinal = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          newFinal += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (newFinal) {
        setTranscript(prev => {
          const joined = prev ? prev + ' ' + newFinal.trim() : newFinal.trim();
          transcriptRef.current = joined;
          return joined;
        });
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // 'no-speech' and 'aborted' are expected — don't surface them
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.error('SpeechRecognition error:', event.error);
      }
      if (event.error !== 'no-speech') {
        isListeningRef.current = false;
        setIsListening(false);
        stopTimer();
      }
    };

    recognition.onend = () => {
      // Auto-restart if we're still supposed to be listening
      // (browser ends session after silence; this keeps it going)
      if (recognitionRef.current === recognition && isListeningRef.current) {
        try { recognition.start(); } catch { /* already started */ }
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      console.error('Could not start recognition:', e);
    }
  }, [supported, locale, isListening, stopTimer]);

  const reset = useCallback(() => {
    stop();
    setTranscript('');
    setInterimTranscript('');
    setDurationSec(0);
    transcriptRef.current = '';
  }, [stop]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      stopTimer();
    };
  }, [stopTimer]);

  return {
    transcript,
    interimTranscript,
    isListening,
    supported,
    durationSec,
    start,
    stop,
    reset,
  };
}
