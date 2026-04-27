import { Mic, CheckCircle2 } from 'lucide-react';
import { useTranscription } from '../lib/useTranscription';
import TranscriptPanel from './TranscriptPanel';

interface Props {
  userId: string | null;
  locale: 'en-AU' | 'en-US';
}

const FEATURES = [
  'Speak freely — no scripts, no prompts',
  'Errors flagged by category with plain-English explanations',
  'Style suggestions to sound more natural',
  'What you did well, always highlighted first',
];

export default function GrammarModule({ userId, locale }: Props) {
  const {
    transcript,
    isListening,
    isTranscribing,
    supported,
    durationSec,
    start,
    stop,
    reset,
  } = useTranscription(locale);

  const wordCount = transcript.trim()
    ? transcript.trim().split(/\s+/).filter(Boolean).length
    : 0;

  // ── Recording or transcribing ────────────────────────────────────────────────
  if (isListening || isTranscribing) {
    return (
      <TranscriptPanel
        transcript={transcript}
        isListening={isListening}
        isTranscribing={isTranscribing}
        durationSec={durationSec}
        onStop={stop}
      />
    );
  }

  // ── Post-recording: transcript captured, not yet analysed ───────────────────
  if (transcript) {
    return (
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-400">
            <span className="text-zinc-200 font-medium">{wordCount} words</span> recorded
          </p>
          <button
            onClick={reset}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Discard &amp; start over
          </button>
        </div>

        {/* Transcript review */}
        <div className="bg-zinc-800/40 border border-zinc-700/60 rounded-xl px-5 py-4 text-sm text-zinc-300 leading-relaxed">
          {transcript}
        </div>

        {/* Analyse CTA — will be wired in Milestone 4 */}
        <div className="flex justify-center">
          <button
            disabled
            className="flex items-center gap-2.5 px-8 py-3 rounded-xl text-sm font-medium
              bg-amber-900/20 text-amber-500/50 border border-amber-800/30
              cursor-not-allowed select-none"
          >
            <Mic size={15} />
            Analyse my speech
            <span className="ml-1 text-[10px] text-amber-600/60 uppercase tracking-wider">Coming soon</span>
          </button>
        </div>
      </div>
    );
  }

  // ── Idle: landing state ─────────────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto py-20 flex flex-col items-center gap-10">

      {/* Icon */}
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl bg-amber-900/25 border border-amber-800/40 flex items-center justify-center">
          <Mic size={26} className="text-amber-400" />
        </div>
        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-500/30 border border-amber-500/50" />
      </div>

      {/* Heading */}
      <div className="text-center">
        <h2 className="text-2xl font-light text-zinc-100 mb-3">Grammar Coach</h2>
        <p className="text-zinc-500 text-sm leading-relaxed">
          Record yourself speaking on any topic. Get personalised coaching on grammar errors, word choice, and what you're already doing well.
        </p>
      </div>

      {/* Feature list */}
      <ul className="w-full flex flex-col gap-2.5">
        {FEATURES.map(f => (
          <li key={f} className="flex items-start gap-3 text-sm text-zinc-400">
            <CheckCircle2 size={15} className="text-amber-500/70 mt-0.5 shrink-0" />
            {f}
          </li>
        ))}
      </ul>

      {/* Start button */}
      {supported ? (
        <button
          onClick={start}
          className="flex items-center gap-2.5 px-7 py-3 rounded-xl text-sm font-medium
            bg-amber-900/30 hover:bg-amber-900/50 text-amber-300 border border-amber-800/40
            transition-all duration-150 active:scale-95"
        >
          <Mic size={15} />
          Start recording
        </button>
      ) : (
        <p className="text-xs text-zinc-600 text-center">
          Speech recognition isn't supported in this browser.<br />
          Try Chrome or Edge.
        </p>
      )}

    </div>
  );
}
