import { useState } from 'react';
import type { PracticeSession } from '../lib/grammar';

interface Props {
  session: PracticeSession;
  onEnd: () => void;
  onDiscard: () => void;
}

export default function SessionControlBar({ session, onEnd, onDiscard }: Props) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="max-w-2xl mx-auto w-full flex items-center justify-between gap-4
      px-4 py-2.5 rounded-xl bg-amber-900/15 border border-amber-800/30">

      {/* Left: active indicator + label */}
      <div className="flex items-center gap-2.5">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-50" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
        </span>
        <span className="text-xs text-zinc-400 font-medium">
          {session.name ?? 'Session in progress'}
        </span>
      </div>

      {/* Right: End + Discard */}
      <div className="flex items-center gap-3 shrink-0">
        {confirming ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Discard session?</span>
            <button
              onClick={() => { setConfirming(false); onDiscard(); }}
              className="text-xs text-rose-400 hover:text-rose-300 transition-colors font-medium"
            >
              Yes
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              No
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={() => setConfirming(true)}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              Discard
            </button>
            <button
              onClick={onEnd}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                bg-emerald-900/30 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-800/40
                transition-all duration-150 active:scale-95"
            >
              End session
            </button>
          </>
        )}
      </div>
    </div>
  );
}
