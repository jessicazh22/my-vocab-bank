import { Check, X } from 'lucide-react';
import { Feedback, Rating, renderSwappedSentence } from '../lib/srs';

interface SentenceFeedbackProps {
  feedback: Feedback;
  sentence: string;
  onRate: (r: Rating) => void;
  onTryAgain: () => void;
  onSkip?: () => void;           // shown in review mode; omit in card practice
  savingRating: boolean;
  confirmedDays?: number | null;
  actionsSlot?: React.ReactNode; // replaces rating buttons (e.g. usefulness picker in WordDetail)
}

const RATING_COLORS: Record<Rating, string> = {
  again: 'bg-rose-900/40 hover:bg-rose-900/70 text-rose-300 border border-rose-800/50',
  hard:  'bg-orange-900/40 hover:bg-orange-900/70 text-orange-300 border border-orange-800/50',
  good:  'bg-zinc-700 hover:bg-zinc-600 text-zinc-200 border border-zinc-600',
  easy:  'bg-emerald-900/40 hover:bg-emerald-900/70 text-emerald-300 border border-emerald-800/50',
};

export default function SentenceFeedback({
  feedback,
  sentence,
  onRate,
  onTryAgain,
  onSkip,
  savingRating,
  confirmedDays,
  actionsSlot,
}: SentenceFeedbackProps) {
  return (
    <div className="space-y-3">
      {/* Verdict line */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className={`p-1 rounded-full shrink-0 ${feedback.correct ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          {feedback.correct
            ? <Check size={12} className="text-white" />
            : <X size={12} className="text-white" />}
        </div>
        <span className="text-xs text-zinc-400">
          {feedback.correct ? 'Used correctly.' : 'Check the meaning.'}
        </span>
        {feedback.structureNote && (
          <span className="text-xs text-zinc-600 italic">— {feedback.structureNote}</span>
        )}
      </div>

      {/* Meaning correction — only when wrong */}
      {feedback.meaningCorrection && (
        <p className="text-rose-300 text-xs leading-relaxed">{feedback.meaningCorrection}</p>
      )}

      {/* Annotated sentence with swaps inline */}
      {feedback.swaps?.length > 0 && (
        <div className="bg-zinc-800/40 rounded-lg p-3 text-sm leading-relaxed">
          {renderSwappedSentence(sentence, feedback.swaps)}
        </div>
      )}

      {/* Swap reasons */}
      {feedback.swaps?.length > 0 && (
        <div className="space-y-1.5">
          {feedback.swaps.map((swap, i) => (
            <p key={i} className="text-xs text-zinc-500 flex items-baseline gap-1.5 flex-wrap">
              <span className="line-through text-zinc-600 shrink-0">{swap.original}</span>
              <span className="text-zinc-300 shrink-0">→ {swap.improved}</span>
              <span className="text-zinc-600">— {swap.reason}</span>
            </p>
          ))}
        </div>
      )}

      {/* Actions */}
      {confirmedDays != null ? (
        <p className="text-xs text-zinc-500 text-center pt-1">
          See you in ~{confirmedDays} day{confirmedDays !== 1 ? 's' : ''}
        </p>
      ) : actionsSlot != null ? (
        actionsSlot
      ) : (
        <div className="space-y-2 pt-1">
          <div className="grid grid-cols-4 gap-1.5">
            {(['again', 'hard', 'good', 'easy'] as Rating[]).map(r => (
              <button
                key={r}
                onClick={() => onRate(r)}
                disabled={savingRating}
                className={`py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 capitalize ${RATING_COLORS[r]}`}
              >
                {r}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <button
              onClick={onTryAgain}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors py-1"
            >
              Edit & resubmit
            </button>
            {onSkip && (
              <button
                onClick={onSkip}
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors py-1"
              >
                Skip
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
