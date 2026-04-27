import { Square } from 'lucide-react';

interface Props {
  transcript: string;
  interimTranscript: string;
  isListening: boolean;
  durationSec: number;
  wordCount: number;
  onStop: () => void;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function TranscriptPanel({
  transcript,
  interimTranscript,
  isListening,
  durationSec,
  wordCount,
  onStop,
}: Props) {
  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">

      {/* Status bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Pulsing mic indicator */}
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
          </span>
          <span className="text-sm text-amber-400 font-medium">Recording</span>
        </div>

        <div className="flex items-center gap-4">
          {/* Word count */}
          <span className="text-sm text-zinc-500 tabular-nums transition-all">
            <span className="text-zinc-300">{wordCount}</span> words
          </span>
          {/* Timer */}
          <span className="text-sm text-zinc-500 tabular-nums font-mono">
            {formatTime(durationSec)}
          </span>
        </div>
      </div>

      {/* Transcript area */}
      <div className="min-h-48 bg-zinc-800/40 border border-zinc-700/60 rounded-xl px-5 py-4 text-sm leading-relaxed">
        {transcript || interimTranscript ? (
          <p>
            <span className="text-zinc-200">{transcript}</span>
            {transcript && interimTranscript && ' '}
            <span className="text-zinc-500 italic">{interimTranscript}</span>
          </p>
        ) : (
          <p className="text-zinc-600 italic">Start speaking — your words will appear here…</p>
        )}
      </div>

      {/* Stop button */}
      <div className="flex justify-center">
        <button
          onClick={onStop}
          className="flex items-center gap-2.5 px-8 py-3 rounded-xl text-sm font-medium
            bg-rose-900/30 hover:bg-rose-900/50 text-rose-300 border border-rose-800/40
            transition-all duration-150 active:scale-95"
        >
          <Square size={14} fill="currentColor" />
          Stop recording
        </button>
      </div>

    </div>
  );
}
