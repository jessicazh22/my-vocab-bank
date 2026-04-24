import { useState, useEffect, useMemo } from 'react';
import { VocabularyWord } from '../lib/supabase';
import { X } from 'lucide-react';
import ChatPanel from './ChatPanel';

type ReviewType = 'learn' | 'revise' | 'review';
type Rating = 'again' | 'hard' | 'good' | 'easy';

interface ReviewModeProps {
  words: VocabularyWord[];
  mode: ReviewType;
  onClose: () => void;
  practiceWord: (id: string, userSentence: string, rating?: Rating, usefulness?: 1 | 2 | 3 | 4) => Promise<void>;
}

const REVISE_PROMPTS = [
  { prompt: "How would you use this in your own words?", verb: "imagining" },
  { prompt: "When might you say this?", verb: "thinking" },
  { prompt: "Picture a moment where this fits perfectly.", verb: "visualizing" },
  { prompt: "Who would you say this to?", verb: "considering" },
  { prompt: "What feeling does this express?", verb: "reflecting" },
  { prompt: "Where could you slip this into conversation?", verb: "imagining" },
];

const RATING_DAYS: Record<Rating, number> = { again: 1, hard: 3, good: 7, easy: 21 };
const USEFULNESS_MULT: Record<number, number> = { 1: 1.5, 2: 1.0, 3: 0.7, 4: 2.5 };

function computeDays(rating: Rating, usefulness: number): number {
  return Math.round(RATING_DAYS[rating] * (USEFULNESS_MULT[usefulness] ?? 1.0));
}

function getRandomPrompt() {
  return REVISE_PROMPTS[Math.floor(Math.random() * REVISE_PROMPTS.length)];
}

const SESSION_SIZE = 5;

export default function ReviewMode({ words, mode, onClose, practiceWord }: ReviewModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showContent, setShowContent] = useState(false);
  const [userSentence, setUserSentence] = useState('');
  const [currentPrompt, setCurrentPrompt] = useState(getRandomPrompt);
  const [selectedCollocation, setSelectedCollocation] = useState<string | null>(null);
  const [confirmedRating, setConfirmedRating] = useState<{ rating: Rating; days: number } | null>(null);
  const [savingRating, setSavingRating] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);
  const [sessionResults, setSessionResults] = useState<Array<{ word: string; rating: Rating; days: number }>>([]);

  const now = useMemo(() => new Date(), []);

  // Build session word list
  const reviewWords = useMemo(() => {
    if (mode === 'learn') {
      const filtered = words.filter(
        (w) => (w.category === 'LEARNING' || w.category === 'JUST_ADDED') && w.word_type !== 'sentence'
      );
      return filtered.sort((a, b) => {
        const aDue = a.next_review_at && new Date(a.next_review_at) <= now;
        const bDue = b.next_review_at && new Date(b.next_review_at) <= now;
        if (aDue && !bDue) return -1;
        if (!aDue && bDue) return 1;
        return 0;
      });
    }

    if (mode === 'revise') {
      const filtered = words.filter(
        (w) => w.word_type === 'sentence' || w.familiarity === 'NEED_TO_USE'
      );
      return filtered.sort((a, b) => {
        const aDue = a.next_review_at && new Date(a.next_review_at) <= now;
        const bDue = b.next_review_at && new Date(b.next_review_at) <= now;
        if (aDue && !bDue) return -1;
        if (!aDue && bDue) return 1;
        return 0;
      });
    }

    // Review mode: build a capped session
    const due = words
      .filter(w => !w.is_archived && w.next_review_at && new Date(w.next_review_at) <= now)
      .sort((a, b) => {
        const diff = new Date(a.next_review_at!).getTime() - new Date(b.next_review_at!).getTime();
        if (diff !== 0) return diff;
        return (b.usefulness ?? 2) - (a.usefulness ?? 2);
      })
      .slice(0, SESSION_SIZE - 1);

    const newWords = words.filter(w =>
      !w.is_archived && !w.next_review_at &&
      (w.category === 'JUST_ADDED' || w.category === 'LEARNING')
    );
    const newWord = newWords[0] ?? null;

    return newWord ? [...due, newWord] : due;
  }, [words, mode, now]);

  const totalDue = useMemo(() => {
    if (mode !== 'review') return 0;
    return words.filter(w => !w.is_archived && w.next_review_at && new Date(w.next_review_at) <= now).length;
  }, [words, mode, now]);

  const currentWord = useMemo(() => reviewWords[currentIndex], [reviewWords, currentIndex]);

  useEffect(() => {
    if (reviewWords.length === 0 && mode !== 'review') onClose();
  }, [reviewWords.length, mode, onClose]);

  // For review mode: get valid collocations for current word
  const validCollocations = useMemo(() => {
    if (!currentWord?.collocations?.pairs) return [];
    const wordLower = currentWord.word.toLowerCase();
    return currentWord.collocations.pairs.filter(p =>
      p.phrase.toLowerCase().includes(wordLower)
    );
  }, [currentWord]);

  // Auto-select collocation if only one valid one
  useEffect(() => {
    setSelectedCollocation(null);
    setShowContent(false);
    setConfirmedRating(null);
  }, [currentIndex]);

  if (reviewWords.length === 0 && mode !== 'review') return null;

  if (sessionDone || (mode === 'review' && reviewWords.length === 0)) {
    const remaining = totalDue - sessionResults.filter(r => r.rating !== undefined).length;
    return (
      <div className="fixed inset-0 bg-zinc-900 z-50 overflow-auto">
        <div className="min-h-screen flex flex-col items-center justify-center p-8">
          <div className="w-full max-w-md space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-light text-zinc-100 mb-1">
                {sessionResults.length === 0 ? 'Nothing due' : 'Session done'}
              </h2>
              {sessionResults.length === 0 ? (
                <p className="text-zinc-500 text-sm">No words due for review right now.</p>
              ) : (
                <p className="text-zinc-500 text-sm">{sessionResults.length} word{sessionResults.length !== 1 ? 's' : ''} reviewed</p>
              )}
            </div>

            {sessionResults.length > 0 && (
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 space-y-2">
                {sessionResults.map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-zinc-300 italic">{r.word}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      r.rating === 'again' ? 'bg-rose-900/40 text-rose-300' :
                      r.rating === 'hard'  ? 'bg-orange-900/40 text-orange-300' :
                      r.rating === 'good'  ? 'bg-zinc-700 text-zinc-300' :
                                            'bg-emerald-900/40 text-emerald-300'
                    }`}>
                      {r.rating} · {r.days}d
                    </span>
                  </div>
                ))}
              </div>
            )}

            {remaining > 0 && sessionResults.length > 0 && (
              <p className="text-center text-xs text-zinc-600">
                {remaining} more due — come back later or continue now
              </p>
            )}

            <button
              onClick={onClose}
              className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition-colors text-sm"
            >
              Done for today
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentWord) return null;

  const goToNext = () => {
    setUserSentence('');
    setShowContent(false);
    setCurrentPrompt(getRandomPrompt());
    setSelectedCollocation(null);
    setConfirmedRating(null);
    if (currentIndex < reviewWords.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      if (mode === 'review') {
        setSessionDone(true);
      } else {
        onClose();
      }
    }
  };

  const handleNext = async () => {
    if (mode === 'learn') {
      if (!userSentence.trim()) return;
      await practiceWord(currentWord.id, userSentence);
    }
    goToNext();
  };

  const handleRate = async (rating: Rating) => {
    setSavingRating(true);
    const usefulness = currentWord.usefulness ?? 2;
    const days = computeDays(rating, usefulness);
    setConfirmedRating({ rating, days });
    await practiceWord(currentWord.id, '', rating);
    setSessionResults(prev => [...prev, { word: currentWord.word, rating, days }]);
    setSavingRating(false);
    setTimeout(() => goToNext(), 900);
  };

  const handleSkip = () => {
    goToNext();
  };

  const isSentence = currentWord.word_type === 'sentence';

  // Display word: in review mode, show selected collocation or bare word
  const displayWord = mode === 'review' && selectedCollocation
    ? selectedCollocation
    : currentWord.word;

  return (
    <div className="fixed inset-0 bg-zinc-900 z-50 overflow-auto">
      <div className="min-h-screen flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-500">
              {currentIndex + 1} / {reviewWords.length}
            </span>
            <span className={`text-xs px-2 py-1 rounded ${
              mode === 'learn'   ? 'bg-amber-900/30 text-amber-400' :
              mode === 'revise'  ? 'bg-teal-900/30 text-teal-400' :
                                   'bg-violet-900/30 text-violet-400'
            }`}>
              {mode === 'learn' ? 'Learn' : mode === 'revise' ? 'Revise' : 'Review'}
            </span>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-100 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-2xl space-y-8">
            <div className="text-center">
              <h1 className={`font-light text-zinc-100 mb-6 ${isSentence ? 'text-2xl md:text-3xl leading-relaxed' : 'text-4xl'}`}>
                {displayWord}
              </h1>

              {/* Collocation picker for review mode */}
              {mode === 'review' && validCollocations.length >= 2 && !showContent && (
                <div className="mb-6">
                  <p className="text-zinc-600 text-xs mb-3">Practice as:</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <button
                      onClick={() => setSelectedCollocation(null)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors border ${
                        selectedCollocation === null
                          ? 'bg-zinc-700 text-zinc-100 border-zinc-500'
                          : 'bg-transparent text-zinc-500 border-zinc-700 hover:text-zinc-300'
                      }`}
                    >
                      {currentWord.word}
                    </button>
                    {validCollocations.map((c, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedCollocation(c.phrase)}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors border ${
                          selectedCollocation === c.phrase
                            ? 'bg-zinc-700 text-zinc-100 border-zinc-500'
                            : 'bg-transparent text-zinc-500 border-zinc-700 hover:text-zinc-300'
                        }`}
                      >
                        {c.phrase}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {mode === 'learn' && currentWord.scaffold_prompt && !showContent && (
                <p className="text-zinc-400 text-lg mb-8 leading-relaxed max-w-xl mx-auto">
                  {currentWord.scaffold_prompt}
                </p>
              )}

              {mode === 'revise' && !showContent && (
                <p className="text-zinc-400 text-lg mb-8 italic">{currentPrompt.prompt}</p>
              )}

              {mode === 'review' && !showContent && (
                <p className="text-zinc-500 text-base mb-8 italic">How well do you know this?</p>
              )}

              {!showContent ? (
                <button
                  onClick={() => setShowContent(true)}
                  className="px-8 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg transition-colors border border-zinc-700"
                >
                  {mode === 'learn' ? 'Show definition' : mode === 'revise' ? "I've thought about it" : 'Show definition'}
                </button>
              ) : (
                <div className="space-y-6">
                  {mode === 'learn' && (
                    <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6 text-left">
                      <p className="text-zinc-300 text-lg leading-relaxed mb-4">{currentWord.definition}</p>
                      {currentWord.example_sentence && (
                        <p className="text-zinc-500 italic leading-relaxed">"{currentWord.example_sentence}"</p>
                      )}
                    </div>
                  )}

                  {(mode === 'revise' || mode === 'review') && (
                    <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6 text-left space-y-4">
                      {currentWord.definition && (
                        <div>
                          <p className="text-zinc-500 text-xs uppercase tracking-wide mb-2">Meaning</p>
                          <p className="text-zinc-200 leading-relaxed">{currentWord.definition}</p>
                        </div>
                      )}
                      {currentWord.usage_hint && (
                        <div>
                          <p className="text-zinc-500 text-xs uppercase tracking-wide mb-2">When to use</p>
                          <p className="text-teal-400/90 leading-relaxed">{currentWord.usage_hint}</p>
                        </div>
                      )}
                      {currentWord.context && (
                        <div>
                          <p className="text-zinc-500 text-xs uppercase tracking-wide mb-2">Context</p>
                          <p className="text-zinc-400 leading-relaxed">{currentWord.context}</p>
                        </div>
                      )}
                      {currentWord.example_sentence && !isSentence && (
                        <div>
                          <p className="text-zinc-500 text-xs uppercase tracking-wide mb-2">Example</p>
                          <p className="text-zinc-400 italic leading-relaxed">"{currentWord.example_sentence}"</p>
                        </div>
                      )}
                    </div>
                  )}

                  {mode === 'learn' && (
                    <>
                      <div className="text-left">
                        <label className="block text-zinc-400 text-sm mb-3">Use it in a sentence:</label>
                        <textarea
                          value={userSentence}
                          onChange={(e) => setUserSentence(e.target.value)}
                          placeholder="Write your own sentence..."
                          rows={4}
                          className="w-full px-4 py-3 bg-zinc-800 text-zinc-100 rounded-lg border border-zinc-700 focus:outline-none focus:border-zinc-500 resize-none"
                          autoFocus
                          spellCheck
                          autoCorrect="on"
                        />
                      </div>
                      <button
                        onClick={handleNext}
                        disabled={!userSentence.trim()}
                        className="w-full py-3 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        I used it
                      </button>
                    </>
                  )}

                  {mode === 'revise' && (
                    <div className="space-y-4">
                      <div className="text-left">
                        <ChatPanel
                          wordId={currentWord.id}
                          word={currentWord.word}
                          definition={currentWord.definition}
                          accent="teal"
                          label="Ask a question"
                        />
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={goToNext}
                          className="flex-1 py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors font-medium"
                        >
                          Done
                        </button>
                        <button
                          onClick={goToNext}
                          className="flex-1 py-3 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-lg transition-colors"
                        >
                          Skip
                        </button>
                      </div>
                      <button
                        onClick={goToNext}
                        className="w-full text-zinc-500 hover:text-zinc-400 text-sm transition-colors py-2"
                      >
                        Not for me
                      </button>
                    </div>
                  )}

                  {mode === 'review' && (
                    <div className="space-y-3">
                      {confirmedRating ? (
                        <p className="text-zinc-500 text-sm text-center py-2">
                          See you in ~{confirmedRating.days} day{confirmedRating.days !== 1 ? 's' : ''}
                        </p>
                      ) : (
                        <>
                          <div className="grid grid-cols-4 gap-2">
                            {(['again', 'hard', 'good', 'easy'] as Rating[]).map(r => (
                              <button
                                key={r}
                                onClick={() => handleRate(r)}
                                disabled={savingRating}
                                className={`py-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 capitalize ${
                                  r === 'again' ? 'bg-rose-900/40 hover:bg-rose-900/70 text-rose-300 border border-rose-800/50' :
                                  r === 'hard'  ? 'bg-orange-900/40 hover:bg-orange-900/70 text-orange-300 border border-orange-800/50' :
                                  r === 'good'  ? 'bg-zinc-700 hover:bg-zinc-600 text-zinc-200 border border-zinc-600' :
                                                  'bg-emerald-900/40 hover:bg-emerald-900/70 text-emerald-300 border border-emerald-800/50'
                                }`}
                              >
                                {r}
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={handleSkip}
                            className="w-full text-zinc-600 hover:text-zinc-400 text-sm transition-colors py-1"
                          >
                            Skip
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
