import { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { Rating, Usefulness, USEFULNESS_LABELS, USEFULNESS_MULT, RATING_DAYS, computeDays } from '../lib/srs';
import { VocabularyWord } from '../lib/supabase';

interface Props {
  words: VocabularyWord[];
  practiceWord: (id: string, sentence: string, rating?: Rating, usefulness?: Usefulness) => Promise<void>;
  onClose: () => void;
}

const RATING_COLORS: Record<Rating, string> = {
  again: 'bg-rose-900/40 hover:bg-rose-900/70 text-rose-300 border border-rose-800/50',
  hard:  'bg-orange-900/40 hover:bg-orange-900/70 text-orange-300 border border-orange-800/50',
  good:  'bg-zinc-700 hover:bg-zinc-600 text-zinc-200 border border-zinc-600',
  easy:  'bg-emerald-900/40 hover:bg-emerald-900/70 text-emerald-300 border border-emerald-800/50',
};

const DAY_BADGE_COLORS: Record<Rating, string> = {
  again: 'bg-rose-900/40 text-rose-300',
  hard:  'bg-orange-900/40 text-orange-300',
  good:  'bg-zinc-700 text-zinc-300',
  easy:  'bg-emerald-900/40 text-emerald-300',
};

export default function OnboardingSession({ words, practiceWord, onClose }: Props) {
  const unqueuedWords = useMemo(
    () => words.filter(w => !w.is_archived && !w.next_review_at),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [] // intentionally snapshot at mount — list shouldn't shift mid-session
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [showContent, setShowContent] = useState(false);
  const [selectedUsefulness, setSelectedUsefulness] = useState<Usefulness | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [results, setResults] = useState<Array<{ word: string; rating: Rating; days: number }>>([]);

  // Reset card state on word change
  useEffect(() => {
    setShowContent(false);
    setSelectedUsefulness(null);
  }, [currentIndex]);

  const currentWord = unqueuedWords[currentIndex];

  const goToNext = () => {
    if (currentIndex + 1 >= unqueuedWords.length) {
      setDone(true);
    } else {
      setCurrentIndex(i => i + 1);
    }
  };

  const handleRate = async (rating: Rating) => {
    if (!currentWord || saving) return;
    const usefulness = selectedUsefulness ?? 2;
    setSaving(true);
    try {
      await practiceWord(currentWord.id, '', rating, usefulness as Usefulness);
      const days = computeDays(rating, usefulness);
      setResults(prev => [...prev, { word: currentWord.word, rating, days }]);
      setTimeout(() => {
        setSaving(false);
        goToNext();
      }, 600);
    } catch {
      setSaving(false);
    }
  };

  // ── Done screen ──────────────────────────────────────────────────────────
  if (done || unqueuedWords.length === 0) {
    const count = results.length;
    return (
      <div className="fixed inset-0 bg-zinc-900 z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <span className="text-sm text-zinc-500">Setup complete</span>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-lg mx-auto px-6 py-16">
            <h2 className="text-3xl font-light text-zinc-100 mb-2">All set.</h2>
            <p className="text-zinc-500 mb-10">
              {count} word{count !== 1 ? 's' : ''} added to your review queue.
            </p>

            <div className="space-y-2">
              {results.map((r, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-800/60">
                  <span className="text-zinc-300 text-sm">{r.word}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${DAY_BADGE_COLORS[r.rating]}`}>
                    ~{r.days}d
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={onClose}
              className="mt-10 w-full py-3 bg-violet-900/40 hover:bg-violet-900/60 text-violet-300 border border-violet-800/50 rounded-lg transition-colors"
            >
              Start reviewing
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Card ─────────────────────────────────────────────────────────────────
  const w = currentWord;
  const examples = w.example_sentence
    ? w.example_sentence.split(' / ').filter(e => {
        const clean = e.trim().replace('[yours] ', '').toLowerCase();
        return clean && !clean.startsWith('unable to');
      })
    : [];

  const progress = currentIndex / unqueuedWords.length;

  return (
    <div className="fixed inset-0 bg-zinc-900 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-4 flex-1">
          <span className="text-sm text-zinc-500">
            {currentIndex + 1} / {unqueuedWords.length}
          </span>
          <div className="flex-1 max-w-xs h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-600 transition-all duration-300"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
        <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-100 transition-colors">
          <X size={20} />
        </button>
      </div>

      {/* Card content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-6 py-12">
          {/* Word */}
          <div className="mb-8">
            <h2 className="text-4xl font-light text-zinc-100 mb-1">{w.word}</h2>
            {w.word_type !== 'word' && (
              <span className="text-xs text-zinc-600 uppercase tracking-wider">{w.word_type}</span>
            )}
          </div>

          {!showContent ? (
            /* Front of card */
            <button
              onClick={() => setShowContent(true)}
              className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors text-sm"
            >
              Show definition
            </button>
          ) : (
            /* Back of card */
            <div className="space-y-6">
              {/* Definition block */}
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-5 space-y-3">
                <p className="text-zinc-100 leading-relaxed">{w.definition}</p>

                {examples.length > 0 && (
                  <ul className="space-y-2 pt-1">
                    {examples.map((ex, i) => {
                      const isYours = ex.trim().startsWith('[yours] ');
                      const text = isYours ? ex.trim().replace('[yours] ', '') : ex.trim();
                      return (
                        <li
                          key={i}
                          className={`italic leading-relaxed pl-3 border-l-2 text-sm ${
                            isYours
                              ? 'border-amber-600/50 text-zinc-300'
                              : 'border-zinc-700 text-zinc-400'
                          }`}
                        >
                          "{text}"
                          {isYours && (
                            <span className="not-italic text-xs ml-2 px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded">
                              yours
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}

                {w.context && (
                  <p className="text-xs text-zinc-500 pt-1">{w.context}</p>
                )}
              </div>

              {/* Usefulness question */}
              <div className="space-y-3">
                <p className="text-sm text-zinc-400">
                  Would you actually say <span className="text-zinc-200 font-medium">"{w.word}"</span>?
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {([1, 2, 3, 4] as Usefulness[]).map(u => (
                    <button
                      key={u}
                      onClick={() => setSelectedUsefulness(u)}
                      className={`py-2.5 px-3 rounded-lg text-sm transition-colors text-left ${
                        selectedUsefulness === u
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-600/50'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border border-transparent'
                      }`}
                    >
                      {USEFULNESS_LABELS[u]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rating buttons — appear after usefulness is picked */}
              {selectedUsefulness !== null && (
                <div className="space-y-2">
                  <p className="text-sm text-zinc-400">How well do you know it?</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['again', 'hard', 'good', 'easy'] as Rating[]).map(r => {
                      const days = computeDays(r, selectedUsefulness);
                      return (
                        <button
                          key={r}
                          onClick={() => handleRate(r)}
                          disabled={saving}
                          className={`py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 flex flex-col items-center gap-0.5 ${RATING_COLORS[r]}`}
                        >
                          <span className="capitalize">{r}</span>
                          <span className="text-[10px] opacity-60">~{days}d</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
