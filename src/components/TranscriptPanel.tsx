import { Square, Loader2, AlertTriangle } from 'lucide-react';
import type { TranscriptSegment } from '../lib/useTranscription';
import { addParagraphBreaks } from './RecordingFeed';

const WARN_SEC   = 20 * 60; // 20 min — soft warning
const STRONG_SEC = 25 * 60; // 25 min — strong prompt
const LIMIT_SEC  = 30 * 60; // 30 min — practical Deepgram limit

interface Props {
  transcript: string;
  interimTranscript: string;
  segments: TranscriptSegment[];
  speakerNames: Record<number, string>;
  isTranscribing: boolean;
  durationSec: number;
  onStop: () => void;
  onSwapSpeakers: () => void;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function minsLeft(durationSec: number): number {
  return Math.ceil((LIMIT_SEC - durationSec) / 60);
}

export default function TranscriptPanel({
  transcript,
  interimTranscript,
  segments,
  speakerNames,
  isTranscribing,
  durationSec,
  onStop,
  onSwapSpeakers,
}: Props) {

  if (isTranscribing) {
    return (
      <div className="max-w-2xl mx-auto flex flex-col items-center gap-5 py-20">
        <Loader2 size={28} className="text-amber-400 animate-spin" />
        <p className="text-zinc-400 text-sm">Transcribing your recording…</p>
      </div>
    );
  }

  const isStrong = durationSec >= STRONG_SEC;
  const isWarn   = durationSec >= WARN_SEC;

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
          <button
            onClick={onSwapSpeakers}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            title="Swap speaker labels"
          >
            <span className="text-amber-400">{speakerNames[0]}</span>
            {' ⇄ '}
            <span className="text-sky-400">{speakerNames[1]}</span>
          </button>
        </div>
        <span className="text-sm text-zinc-500 tabular-nums font-mono">
          {formatTime(durationSec)}
          {isWarn && (
            <span className={`ml-2 text-xs ${isStrong ? 'text-rose-400' : 'text-amber-500'}`}>
              {minsLeft(durationSec)} min left
            </span>
          )}
        </span>
      </div>

      {/* Length warning banner */}
      {isStrong ? (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-rose-900/20 border border-rose-800/40">
          <AlertTriangle size={15} className="text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-rose-300 font-medium">Stop and save now</p>
            <p className="text-xs text-rose-400/70 mt-0.5">
              Approaching the 30-minute limit — connection may drop. Stop recording and start a new chunk.
            </p>
          </div>
        </div>
      ) : isWarn ? (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-900/15 border border-amber-800/30">
          <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-400/80">
            20 minutes in — consider wrapping up this chunk soon.
          </p>
        </div>
      ) : null}

      {/* Transcript area */}
      <div className="min-h-48 bg-zinc-800/40 border border-zinc-700/60 rounded-xl px-5 py-4 text-sm leading-relaxed flex flex-col gap-3">
        {segments.length === 0 && !interimTranscript && !transcript ? (
          <p className="text-zinc-600 italic">Start speaking — your words will appear here…</p>
        ) : segments.length > 0 ? (
          <>
            {segments.map((seg, i) => {
              const isLast = i === segments.length - 1;
              const paras = addParagraphBreaks(seg.text).split('\n\n').filter(Boolean);
              return (
                <div key={i} className="flex flex-col gap-0.5">
                  <span className={`text-[11px] font-semibold uppercase tracking-wider ${
                    seg.speaker === 0 ? 'text-amber-400' : 'text-sky-400'
                  }`}>
                    {speakerNames[seg.speaker] ?? `Speaker ${seg.speaker}`}
                  </span>
                  {paras.map((para, j) => (
                    <p key={j} className="text-zinc-200 leading-relaxed">
                      {para}
                      {isLast && j === paras.length - 1 && interimTranscript && (
                        <span className="text-zinc-500 italic"> {interimTranscript}</span>
                      )}
                    </p>
                  ))}
                </div>
              );
            })}
          </>
        ) : (
          // Deepgram not yet connected — flat fallback
          <p>
            <span className="text-zinc-200">{transcript}</span>
            {interimTranscript && <span className="text-zinc-500 italic"> {interimTranscript}</span>}
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
