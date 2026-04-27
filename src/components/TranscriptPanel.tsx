import { Square, Loader2 } from 'lucide-react';

interface Props {
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

export default function TranscriptPanel({ isListening, isTranscribing, durationSec, onStop }: Props) {

  // ── Transcribing state ──────────────────────────────────────────────────────
  if (isTranscribing) {
    return (
      <div className="max-w-2xl mx-auto flex flex-col items-center gap-5 py-20">
        <Loader2 size={28} className="text-amber-400 animate-spin" />
        <p className="text-zinc-400 text-sm">Transcribing your recording…</p>
      </div>
    );
  }

  // ── Recording state ─────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">

      {/* Status bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
          </span>
          <span className="text-sm text-amber-400 font-medium">Recording</span>
        </div>
        <span className="text-sm text-zinc-500 tabular-nums font-mono">
          {formatTime(durationSec)}
        </span>
      </div>

      {/* Visual placeholder — no live transcript with MediaRecorder */}
      <div className="min-h-48 bg-zinc-800/40 border border-zinc-700/60 rounded-xl px-5 py-4 flex items-center justify-center">
        <p className="text-zinc-600 italic text-sm text-center leading-relaxed">
          Speak naturally — your transcript will appear<br />once you stop recording.
        </p>
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
