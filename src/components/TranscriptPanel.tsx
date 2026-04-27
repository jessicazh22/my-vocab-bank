import { Square, Loader2 } from 'lucide-react';

interface Props {
  transcript: string;
  isListening: boolean;
  isTranscribing: boolean;
  durationSec: number;
  onStop: () => void;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function TranscriptPanel({
  transcript,
  isListening,
  isTranscribing,
  durationSec,
  onStop,
}: Props) {
  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">

      {/* Status bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isListening && (
            <>
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
              </span>
              <span className="text-sm text-amber-400 font-medium">Recording</span>
            </>
          )}
          {isTranscribing && (
            <span className="flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 size={13} className="animate-spin" />
              Transcribing…
            </span>
          )}
        </div>
        <span className="text-sm text-zinc-500 tabular-nums font-mono">
          {formatTime(durationSec)}
        </span>
      </div>

      {/* Transcript area */}
      <div className="min-h-48 bg-zinc-800/40 border border-zinc-700/60 rounded-xl px-5 py-4 text-sm leading-relaxed">
        {transcript ? (
          <p className="text-zinc-200 whitespace-pre-wrap">{transcript}</p>
        ) : (
          <p className="text-zinc-600 italic">
            Start speaking — your words will appear here every few seconds…
          </p>
        )}
      </div>

      {/* Stop */}
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
