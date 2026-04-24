import { useState, useEffect, useMemo } from 'react';
import { VocabularyWord, callEdgeFunction } from '../lib/supabase';
import { X, Check, Loader2 } from 'lucide-react';
import { Rating, Feedback, computeDays } from '../lib/srs';
import SentenceFeedback from './SentenceFeedback';
import ScaffoldPrompt from './ScaffoldPrompt';
import ChatPanel from './ChatPanel';

type ReviewType = 'learn' | 'revise' | 'review';

interface McOptions { options: string[]; bestIndex: number; reason: string; }

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

  // Review mode: sentence practice state
  const [reviewFeedback, setReviewFeedback] = useState<Feedback | null>(null);
  const [reviewEvaluating, setReviewEvaluating] = useState(false);
  const [reviewSentence, setReviewSentence] = useState('');

  // Review mode: A/B/C state (usefulness=1)
  const [mcOptions, setMcOptions] = useState<McOptions | null>(null);
  const [mcLoading, setMcLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [mcRevealed, setMcRevealed] = useState(false);

  // Review mode: dynamic collocation scaffold
  const [collocationScaffold, setCollocationScaffold] = useState<string | null>(null);
  const [collocationScaffoldLoading, setCollocationScaffoldLoading] = useState(false);

  const now = useMemo(() => new Date(), []);

  const reviewWords = useMemo(() => {
    if (mode === 'learn') {
      return words
        .filter(w => (w.category === 'LEARNING' || w.category === 'JUST_ADDED') && w.word_type !== 'sentence')
        .sort((a, b) => {
          const aDue = a.next_review_at && new Date(a.next_review_at) <= now;
          const bDue = b.next_review_at && new Date(b.next_review_at) <= now;
          if (aDue && !bDue) return -1;
          if (!aDue && bDue) return 1;
          return 0;
        });
    }
    if (mode === 'revise') {
      return words
        .filter(w => w.word_type === 'sentence' || w.familiarity === 'NEED_TO_USE')
        .sort((a, b) => {
          const aDue = a.next_review_at && new Date(a.next_review_at) <= now;
          const bDue = b.next_review_at && new Date(b.next_review_at) <= now;
          if (aDue && !bDue) return -1;
          if (!aDue && bDue) return 1;
          return 0;
        });
    }
    // Review mode: capped session
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

  const isRecognitionMode = mode === 'review' && (currentWord?.usefulness ?? 2) === 1;

  useEffect(() => {
    if (reviewWords.length === 0 && mode !== 'review') onClose();
  }, [reviewWords.length, mode, onClose]);

  // Valid collocations for current word
  const validCollocations = useMemo(() => {
    if (!currentWord?.collocations?.pairs) return [];
    const wordLower = currentWord.word.toLowerCase();
    return currentWord.collocations.pairs.filter(p =>
      p.phrase.toLowerCase().includes(wordLower)
    );
  }, [currentWord]);

  // Reset per-word state when word changes
  useEffect(() => {
    setSelectedCollocation(null);
    setShowContent(false);
    setConfirmedRating(null);
    setReviewFeedback(null);
    setReviewSentence('');
    setReviewEvaluating(false);
    setMcOptions(null);
    setMcLoading(false);
    setSelectedOption(null);
    setMcRevealed(false);
    setCollocationScaffold(null);
    setCollocationScaffoldLoading(false);
  }, [currentIndex]);

  // Generate collocation-specific scaffold when a collocation is picked
  useEffect(() => {
    if (!selectedCollocation || !currentWord) return;
    setCollocationScaffold(null);
    setCollocationScaffoldLoading(true);
    const collocPair = currentWord.collocations?.pairs?.find(
      p => p.phrase === selectedCollocation
    );
    callEdgeFunction<{ scaffoldPrompt: string }>('enrich-word', {
      word: currentWord.word,
      definition: currentWord.definition,
      context: currentWord.context,
      scaffoldOnly: true,
      targetCollocation: { phrase: selectedCollocation, note: collocPair?.note },
    }).then(data => {
      if (data?.scaffoldPrompt) setCollocationScaffold(data.scaffoldPrompt);
    }).catch(() => {
      // fall back to generic scaffold silently
    }).finally(() => {
      setCollocationScaffoldLoading(false);
    });
  }, [selectedCollocation, currentWord]);

  // Load MC options when content is shown for usefulness=1 words in review mode
  useEffect(() => {
    if (!showContent || !isRecognitionMode || mcOptions || mcLoading) return;
    const word = currentWord;
    if (!word) return;
    setMcLoading(true);
    callEdgeFunction<McOptions>('enrich-word', {
      word: word.word,
      definition: word.definition,
      multipleChoiceOnly: true,
    }).then(data => {
      if (data?.options?.length === 3 && typeof data.bestIndex === 'number') {
        setMcOptions(data);
      }
    }).catch(() => {
      // fail silently — falls back to sentence production
    }).finally(() => {
      setMcLoading(false);
    });
  }, [showContent, isRecognitionMode, currentWord, mcOptions, mcLoading]);

  if (reviewWords.length === 0 && mode !== 'review') return null;

  // Session done screen
  if (sessionDone || (mode === 'review' && reviewWords.length === 0)) {
    const remaining = Math.max(0, totalDue - sessionResults.length);
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
      if (mode === 'review') setSessionDone(true);
      else onClose();
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
    const sentenceToSave = mode === 'review' ? reviewSentence : '';
    await practiceWord(currentWord.id, sentenceToSave, rating);
    setSessionResults(prev => [...prev, { word: currentWord.word, rating, days }]);
    setSavingRating(false);
    setTimeout(() => goToNext(), 900);
  };

  const handleSkip = () => goToNext();

  const handleReviewTryAgain = () => {
    setReviewFeedback(null);
  };

  const handleReviewSubmit = async () => {
    if (!reviewSentence.trim()) return;
    setReviewEvaluating(true);
    try {
      const data = await callEdgeFunction<Feedback>('evaluate-sentence', {
        word: currentWord.word,
        definition: currentWord.definition,
        sentence: reviewSentence,
      });
      setReviewFeedback(data);
    } catch {
      setReviewFeedback({ correct: true, swaps: [] });
    } finally {
      setReviewEvaluating(false);
    }
  };

  const isSentence = currentWord.word_type === 'sentence';
  const displayWord = mode === 'review' && selectedCollocation ? selectedCollocation : currentWord.word;

  // Parse example sentences
  const exampleSentences = currentWord.example_sentence
    ? currentWord.example_sentence.split(' / ').filter(e => {
        const clean = e.trim().replace('[yours] ', '').toLowerCase();
        return clean && !clean.startsWith('unable to');
      })
    : [];

  return (
    <div className="fixed inset-0 bg-zinc-900 z-50 overflow-auto">
      <div className="min-h-screen flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-500">
              {currentIndex + 1} / {reviewWords.length}
            </span>
            <span className={`text-xs px-2 py-1 rounded ${
              mode === 'learn'  ? 'bg-amber-900/30 text-amber-400' :
              mode === 'revise' ? 'bg-teal-900/30 text-teal-400' :
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

              {/* Collocation picker */}
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
                <p className="text-zinc-500 text-base mb-8 italic">
                  {isRecognitionMode ? 'Which sentence uses this most accurately?' : 'How well do you know this?'}
                </p>
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

                  {/* Definition + content block */}
                  {mode === 'learn' && (
                    <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6 text-left">
                      <p className="text-zinc-300 text-lg leading-relaxed mb-4">{currentWord.definition}</p>
                      {exampleSentences.length > 0 && (
                        <ul className="space-y-2">
                          {exampleSentences.map((example, i) => {
                            const isYours = example.trim().startsWith('[yours] ');
                            const text = isYours ? example.trim().replace('[yours] ', '') : example.trim();
                            return (
                              <li key={i} className={`italic leading-relaxed pl-3 border-l-2 text-sm ${
                                isYours ? 'border-amber-600/50 text-zinc-300' : 'border-zinc-700 text-zinc-400'
                              }`}>
                                "{text}"
                                {isYours && (
                                  <span className="not-italic text-xs ml-2 px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded">yours</span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
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
                      {exampleSentences.length > 0 && !isSentence && (
                        <div>
                          <p className="text-zinc-500 text-xs uppercase tracking-wide mb-2">Example{exampleSentences.length > 1 ? 's' : ''}</p>
                          <ul className="space-y-2">
                            {exampleSentences.map((example, i) => {
                              const isYours = example.trim().startsWith('[yours] ');
                              const text = isYours ? example.trim().replace('[yours] ', '') : example.trim();
                              return (
                                <li key={i} className={`italic leading-relaxed pl-3 border-l-2 text-sm ${
                                  isYours ? 'border-amber-600/50 text-zinc-300' : 'border-zinc-700 text-zinc-400'
                                }`}>
                                  "{text}"
                                  {isYours && (
                                    <span className="not-italic text-xs ml-2 px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded">yours</span>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Learn mode: textarea */}
                  {mode === 'learn' && (
                    <>
                      <div className="text-left">
                        <label className="block text-zinc-400 text-sm mb-3">Use it in a sentence:</label>
                        <textarea
                          value={userSentence}
                          onChange={e => setUserSentence(e.target.value)}
                          placeholder="Write your own sentence..."
                          rows={4}
                          className="w-full px-4 py-3 bg-zinc-800 text-zinc-100 rounded-lg border border-zinc-700 focus:outline-none focus:border-zinc-500 resize-none"
                          autoFocus spellCheck autoCorrect="on"
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

                  {/* Revise mode */}
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
                        <button onClick={goToNext} className="flex-1 py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors font-medium">Done</button>
                        <button onClick={goToNext} className="flex-1 py-3 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-lg transition-colors">Skip</button>
                      </div>
                      <button onClick={goToNext} className="w-full text-zinc-500 hover:text-zinc-400 text-sm transition-colors py-2">Not for me</button>
                    </div>
                  )}

                  {/* Review mode: A/B/C recognition (usefulness=1) */}
                  {mode === 'review' && isRecognitionMode && (
                    <div className="space-y-3">
                      {confirmedRating ? (
                        <p className="text-zinc-500 text-sm text-center py-2">
                          See you in ~{confirmedRating.days} day{confirmedRating.days !== 1 ? 's' : ''}
                        </p>
                      ) : mcLoading ? (
                        <div className="flex items-center justify-center gap-2 py-8 text-zinc-500">
                          <Loader2 size={16} className="animate-spin" />
                          <span className="text-sm">Loading options...</span>
                        </div>
                      ) : mcOptions ? (
                        <>
                          {!mcRevealed && (
                            <p className="text-zinc-500 text-xs text-center mb-4">Which sentence uses "{currentWord.word}" most accurately?</p>
                          )}
                          <div className="space-y-2 text-left">
                            {mcOptions.options.map((opt, i) => {
                              const label = ['A', 'B', 'C'][i];
                              const isSelected = selectedOption === i;
                              const isBest = i === mcOptions.bestIndex;
                              let cardStyle = 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-500 cursor-pointer';
                              if (mcRevealed) {
                                if (isBest) cardStyle = 'border-emerald-600/60 bg-emerald-900/20';
                                else if (isSelected && !isBest) cardStyle = 'border-rose-700/50 bg-rose-900/10 opacity-60';
                                else cardStyle = 'border-zinc-800 bg-zinc-800/30 opacity-40';
                              } else if (isSelected) {
                                cardStyle = 'border-violet-500/60 bg-violet-900/10';
                              }
                              return (
                                <button
                                  key={i}
                                  onClick={() => {
                                    if (mcRevealed) return;
                                    setSelectedOption(i);
                                    setMcRevealed(true);
                                  }}
                                  className={`w-full text-left rounded-lg border p-4 transition-all ${cardStyle}`}
                                >
                                  <div className="flex items-start gap-3">
                                    <span className={`text-xs font-medium mt-0.5 shrink-0 ${
                                      mcRevealed && isBest ? 'text-emerald-400' :
                                      mcRevealed && isSelected && !isBest ? 'text-rose-400' :
                                      'text-zinc-500'
                                    }`}>{label}</span>
                                    <span className="text-sm text-zinc-300 leading-relaxed italic">"{opt}"</span>
                                    {mcRevealed && isBest && <Check size={14} className="text-emerald-400 shrink-0 mt-0.5 ml-auto" />}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                          {mcRevealed && (
                            <div className="space-y-3 pt-1">
                              <p className="text-xs text-zinc-500 text-left pl-1">{mcOptions.reason}</p>
                              <SentenceFeedback
                                feedback={{ correct: true, swaps: [] }}
                                sentence=""
                                onRate={handleRate}
                                onTryAgain={() => {}}
                                onSkip={handleSkip}
                                savingRating={savingRating}
                                confirmedDays={confirmedRating?.days ?? null}
                              />
                            </div>
                          )}
                        </>
                      ) : (
                        // MC failed — fall through to sentence production below
                        <ReviewSentenceProduction
                          word={currentWord}
                          selectedCollocation={selectedCollocation}
                          collocationScaffold={collocationScaffold}
                          collocationScaffoldLoading={collocationScaffoldLoading}
                          reviewSentence={reviewSentence}
                          setReviewSentence={setReviewSentence}
                          reviewFeedback={reviewFeedback}
                          reviewEvaluating={reviewEvaluating}
                          handleReviewSubmit={handleReviewSubmit}
                          handleRate={handleRate}
                          handleSkip={handleSkip}
                          handleTryAgain={handleReviewTryAgain}
                          savingRating={savingRating}
                          confirmedRating={confirmedRating}
                        />
                      )}
                    </div>
                  )}

                  {/* Review mode: sentence production (usefulness >= 2) */}
                  {mode === 'review' && !isRecognitionMode && (
                    <ReviewSentenceProduction
                      word={currentWord}
                      selectedCollocation={selectedCollocation}
                      collocationScaffold={collocationScaffold}
                      collocationScaffoldLoading={collocationScaffoldLoading}
                      reviewSentence={reviewSentence}
                      setReviewSentence={setReviewSentence}
                      reviewFeedback={reviewFeedback}
                      reviewEvaluating={reviewEvaluating}
                      handleReviewSubmit={handleReviewSubmit}
                      handleRate={handleRate}
                      handleSkip={handleSkip}
                      handleTryAgain={handleReviewTryAgain}
                      savingRating={savingRating}
                      confirmedRating={confirmedRating}
                    />
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

// ── Sentence production sub-component (review mode usefulness >= 2, and MC fallback)
interface SentenceProductionProps {
  word: VocabularyWord;
  selectedCollocation: string | null;
  collocationScaffold: string | null;
  collocationScaffoldLoading: boolean;
  reviewSentence: string;
  setReviewSentence: (s: string) => void;
  reviewFeedback: Feedback | null;
  reviewEvaluating: boolean;
  handleReviewSubmit: () => void;
  handleRate: (r: Rating) => void;
  handleSkip: () => void;
  handleTryAgain: () => void;
  savingRating: boolean;
  confirmedRating: { rating: Rating; days: number } | null;
}

function ReviewSentenceProduction({
  word, selectedCollocation, collocationScaffold, collocationScaffoldLoading,
  reviewSentence, setReviewSentence, reviewFeedback,
  reviewEvaluating, handleReviewSubmit, handleRate, handleSkip, handleTryAgain,
  savingRating, confirmedRating,
}: SentenceProductionProps) {
  return (
    <div className="space-y-4">
      {confirmedRating ? (
        <p className="text-zinc-500 text-sm text-center py-2">
          See you in ~{confirmedRating.days} day{confirmedRating.days !== 1 ? 's' : ''}
        </p>
      ) : !reviewFeedback ? (
        <>
          <ScaffoldPrompt
            loading={selectedCollocation ? collocationScaffoldLoading : false}
            text={selectedCollocation
              ? (collocationScaffold ?? undefined)
              : (word.scaffold_prompt ?? undefined)}
            fallback={selectedCollocation ? `Try using '${selectedCollocation}' in a sentence.` : undefined}
          />
          <div className="text-left">
            <textarea
              value={reviewSentence}
              onChange={e => setReviewSentence(e.target.value)}
              placeholder={selectedCollocation ? `${selectedCollocation}...` : 'Write a sentence using this word...'}
              rows={3}
              className="w-full px-4 py-3 bg-zinc-800 text-zinc-100 rounded-lg border border-zinc-700 focus:outline-none focus:border-violet-600/50 resize-none text-sm"
              autoFocus spellCheck autoCorrect="on"
            />
          </div>
          <button
            onClick={handleReviewSubmit}
            disabled={!reviewSentence.trim() || reviewEvaluating}
            className="w-full py-3 bg-violet-700/40 hover:bg-violet-700/60 text-violet-200 rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-violet-700/40"
          >
            {reviewEvaluating ? <><Loader2 size={16} className="animate-spin" />Checking...</> : 'Submit'}
          </button>
        </>
      ) : (
        <SentenceFeedback
          feedback={reviewFeedback}
          sentence={reviewSentence}
          onRate={handleRate}
          onTryAgain={handleTryAgain}
          onSkip={handleSkip}
          savingRating={savingRating}
          confirmedDays={confirmedRating?.days ?? null}
        />
      )}
    </div>
  );
}
