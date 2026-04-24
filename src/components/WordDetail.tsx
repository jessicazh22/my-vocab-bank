import { useState, useEffect } from 'react';
import { X, BookMarked, GraduationCap, Loader2, RefreshCw, Undo2, Sparkles, RotateCcw, Globe, Lock } from 'lucide-react';
import { VocabularyWord, callEdgeFunction } from '../lib/supabase';
import { getTagColor } from '../lib/utils';
import { Rating, Usefulness, Feedback, computeDays, USEFULNESS_LABELS } from '../lib/srs';
import SentenceFeedback from './SentenceFeedback';
import ScaffoldPrompt from './ScaffoldPrompt';
import ChatPanel from './ChatPanel';

function extractSynonym(distinction: string, word: string): string | null {
  // "whereas [synonym]" or "unlike [synonym]"
  const contrastMatch = distinction.match(/(?:whereas|unlike)\s+([a-zA-Z-]+)/i);
  if (contrastMatch) return contrastMatch[1];
  // "; [synonym] is" or "; [synonym]" — after semicolon
  const semicolonMatch = distinction.match(/;\s*([a-zA-Z-]+)/i);
  if (semicolonMatch && semicolonMatch[1].toLowerCase() !== word.toLowerCase()) return semicolonMatch[1];
  // Capitalised word before " is " or " ="
  const isMatches = [...distinction.matchAll(/([A-Z][a-z-]+)(?:\s+is\s+|\s*=\s*)/g)];
  for (const m of isMatches) {
    if (m[1].toLowerCase() !== word.toLowerCase()) return m[1];
  }
  return null;
}

interface WordDetailProps {
  word: VocabularyWord;
  onClose: () => void;
  onWordUpdate?: () => void;
  updateWord: (id: string, updates: Partial<VocabularyWord>) => Promise<void>;
  practiceWord: (id: string, userSentence: string, rating?: Rating, usefulness?: Usefulness) => Promise<void>;
  setReviewDate?: (id: string, next_review_at: string | null) => Promise<void>;
  isReadOnly?: boolean;
}

interface PreviousEnrichment {
  example_sentence: string;
  context: string;
  scaffold_prompt?: string;
}

export default function WordDetail({ word, onClose, onWordUpdate, updateWord, practiceWord, setReviewDate, isReadOnly = false }: WordDetailProps) {
  const [learningMode, setLearningMode] = useState(false);
  const [showCard, setShowCard] = useState(true);
  const [userSentence, setUserSentence] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [editingDefinition, setEditingDefinition] = useState(false);
  const [definitionDraft, setDefinitionDraft] = useState('');
  const [localWord, setLocalWord] = useState(word);
  const [previousEnrichment, setPreviousEnrichment] = useState<PreviousEnrichment | null>(null);
  const [scaffoldLoading, setScaffoldLoading] = useState(false);
  const [showCollocations, setShowCollocations] = useState(false);
  const [targetCollocation, setTargetCollocation] = useState<{ phrase: string; note?: string } | null>(null);
  const [collocationScaffold, setCollocationScaffold] = useState<string | null>(null);
  const [collocationScaffoldLoading, setCollocationScaffoldLoading] = useState(false);
  const [distinctionRegenerating, setDistinctionRegenerating] = useState(false);
  const [distinctionExpanded, setDistinctionExpanded] = useState(false);
  // Spaced repetition state
  const [pendingRating, setPendingRating] = useState<Rating | null>(null);
  const [showUsefulnessPicker, setShowUsefulnessPicker] = useState(false);
  const [confirmedDays, setConfirmedDays] = useState<number | null>(null);
  const [savingRating, setSavingRating] = useState(false);

  useEffect(() => {
    setLocalWord(word);
  }, [word]);

  // Auto-clean any stored "Unable to generate examples." error strings from example_sentence
  // Also reset distinction expanded state when the word changes
  useEffect(() => {
    setDistinctionExpanded(false); // always start collapsed — user can expand on demand
    if (!localWord.example_sentence) return;
    if (!localWord.example_sentence.includes('Unable to generate')) return;
    const cleaned = localWord.example_sentence
      .split(' / ')
      .filter(e => {
        const clean = e.trim().replace('[yours] ', '').toLowerCase();
        return clean && !clean.startsWith('unable to');
      })
      .join(' / ');
    if (cleaned !== localWord.example_sentence) {
      updateWord(localWord.id, { example_sentence: cleaned || undefined });
      setLocalWord(prev => ({ ...prev, example_sentence: cleaned || undefined }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localWord.id]);

  // Silently generate collocations for existing words that don't have them yet
  // Distinction is on-demand only (user clicks "how does it differ?")
  useEffect(() => {
    const missingCollocations = !localWord.collocations && localWord.word_type === 'word';
    if (!localWord.definition || !missingCollocations) return;

    const generate = async () => {
      try {
        const data = await callEdgeFunction<any>('enrich-word', {
          word: localWord.word,
          definition: localWord.definition,
          defineOnly: true,
        });
        const updates: Partial<VocabularyWord> = {};
        if (data.collocations?.pairs?.length) updates.collocations = data.collocations;
        if (data.distinction) updates.distinction = data.distinction;
        if (Object.keys(updates).length) {
          await updateWord(localWord.id, updates);
          setLocalWord(prev => ({ ...prev, ...updates }));
        }
      } catch {
        // fail silently
      }
    };
    generate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localWord.id]);

  const canLearn = localWord.word_type !== 'sentence';

  const getOriginalExample = (exampleStr: string | undefined): string | null => {
    if (!exampleStr) return null;
    const parts = exampleStr.split(' / ');
    const yours = parts.find(p => p.startsWith('[yours] '));
    return yours ? yours.replace('[yours] ', '') : null;
  };

  const handleStartLearning = async () => {
    setTargetCollocation(null);
    setLearningMode(true);
    setShowCard(false);
    setFeedback(null);
    setUserSentence('');

    const shouldGenerateScaffold = !localWord.scaffold_prompt || localWord.user_sentences.length > 0;
    if (shouldGenerateScaffold) {
      setScaffoldLoading(true);
      try {
        const needsFullEnrich = !localWord.example_sentence || !localWord.context;
        const data = await callEdgeFunction<any>('enrich-word', {
          word: localWord.word,
          definition: localWord.definition,
          context: localWord.context,
          previousSentences: localWord.user_sentences.length > 0 ? localWord.user_sentences : undefined,
          scaffoldOnly: !needsFullEnrich,
        });
        if (data.scaffoldPrompt) {
          const updates: Partial<VocabularyWord> = { scaffold_prompt: data.scaffoldPrompt };
          if (needsFullEnrich) {
            if (data.examples) {
              const yoursExample = getOriginalExample(localWord.example_sentence);
              const maxAi = yoursExample ? 2 : 3;
              const aiExamples = data.examples.slice(0, maxAi).join(' / ');
              updates.example_sentence = yoursExample
                ? `[yours] ${yoursExample} / ${aiExamples}`
                : aiExamples;
            }
            if (data.context) updates.context = data.context;
          }
          await updateWord(word.id, updates);
          setLocalWord(prev => ({
            ...prev,
            scaffold_prompt: data.scaffoldPrompt,
            example_sentence: updates.example_sentence || prev.example_sentence,
            context: updates.context || prev.context,
          }));
          onWordUpdate?.();
        }
      } catch {
        // Scaffold generation failed, continue without it
      } finally {
        setScaffoldLoading(false);
      }
    }
  };

  const handleStartLearningWithCollocation = async (item: { phrase: string; note?: string }) => {
    setTargetCollocation(item);
    setCollocationScaffold(null);
    setLearningMode(true);
    setShowCard(false);
    setFeedback(null);
    setUserSentence('');

    setCollocationScaffoldLoading(true);
    try {
      const data = await callEdgeFunction<any>('enrich-word', {
        word: localWord.word,
        definition: localWord.definition,
        context: localWord.context,
        scaffoldOnly: true,
        targetCollocation: item,
      });
      if (data.scaffoldPrompt) setCollocationScaffold(data.scaffoldPrompt);
    } catch { /* fail silently — falls back to static template */ }
    finally { setCollocationScaffoldLoading(false); }
  };

  const handleExitLearning = () => {
    setLearningMode(false);
    setShowCard(false);
    setFeedback(null);
    setTargetCollocation(null);
    setCollocationScaffold(null);
    setPendingRating(null);
    setShowUsefulnessPicker(false);
    setConfirmedDays(null);
    setSavingRating(false);
  };

  const handleRegenerateDistinction = async () => {
    setDistinctionRegenerating(true);
    try {
      const data = await callEdgeFunction<any>('enrich-word', {
        word: localWord.word,
        definition: localWord.definition,
        distinctionOnly: true,
      });
      const newDistinction = data.distinction || '';
      await updateWord(localWord.id, { distinction: newDistinction });
      setLocalWord(prev => ({ ...prev, distinction: newDistinction }));
      if (newDistinction) setDistinctionExpanded(true);
    } catch {
      // fail silently
    } finally {
      setDistinctionRegenerating(false);
    }
  };

  const handlePractice = async () => {
    if (!userSentence.trim()) return;
    setEvaluating(true);
    setFeedback(null);
    try {
      const data = await callEdgeFunction<Feedback>('evaluate-sentence', {
        word: localWord.word,
        definition: localWord.definition,
        sentence: userSentence,
      });
      setFeedback(data);
      if (!isReadOnly) {
        await practiceWord(word.id, userSentence);
        onWordUpdate?.();
      }
    } catch {
      setFeedback({ correct: true, feedback: 'Great practice!' });
      if (!isReadOnly) {
        await practiceWord(word.id, userSentence);
        onWordUpdate?.();
      }
    } finally {
      setEvaluating(false);
    }
  };

  const handleTryAgain = () => {
    setFeedback(null);
    // Keep the sentence so the user can edit rather than retype
  };

  const handleRate = async (rating: Rating) => {
    setPendingRating(rating);
    const usefulness = (localWord.usefulness ?? 2) as Usefulness;
    const days = computeDays(rating, usefulness);
    setConfirmedDays(days);

    // If this is the very first practice, show usefulness picker before closing
    if (localWord.practice_count === 0) {
      setShowUsefulnessPicker(true);
      // Save practice + rating now (usefulness will be updated in handleUsefulness)
      setSavingRating(true);
      await practiceWord(word.id, userSentence, rating);
      setLocalWord(prev => ({ ...prev, practice_count: prev.practice_count + 1 }));
      setSavingRating(false);
      onWordUpdate?.();
    } else {
      setSavingRating(true);
      await practiceWord(word.id, userSentence, rating);
      setSavingRating(false);
      onWordUpdate?.();
      setTimeout(() => handleExitLearning(), 1200);
    }
  };

  const handleUsefulness = async (usefulness: Usefulness) => {
    // Update usefulness and recalculate next_review_at with it
    const rating = pendingRating!;
    const days = computeDays(rating, usefulness);
    setConfirmedDays(days);
    await practiceWord(word.id, '', rating, usefulness);
    setLocalWord(prev => ({ ...prev, usefulness }));
    onWordUpdate?.();
    setTimeout(() => handleExitLearning(), 1200);
  };

  const handleEnrich = async () => {
    if (localWord.example_sentence && localWord.context) {
      setPreviousEnrichment({
        example_sentence: localWord.example_sentence,
        context: localWord.context,
        scaffold_prompt: localWord.scaffold_prompt,
      });
    }
    setEnriching(true);
    try {
      const existingOriginal = getOriginalExample(localWord.example_sentence);
      const existingParts = localWord.example_sentence?.split(' / ') || [];
      const userOriginal = existingOriginal
        || (existingParts.length === 1 && existingParts[0] ? existingParts[0] : null);

      const data = await callEdgeFunction<any>('enrich-word', {
        word: localWord.word,
        definition: localWord.definition,
      });
      if (data.examples) {
        const maxAi = userOriginal ? 2 : 3;
        const aiExamples = data.examples.slice(0, maxAi).join(' / ');
        const exampleSentence = userOriginal
          ? `[yours] ${userOriginal} / ${aiExamples}`
          : aiExamples;
        const updates: Partial<VocabularyWord> = {
          example_sentence: exampleSentence,
          // context intentionally not updated — user triggered examples-only regeneration
        };
        await updateWord(word.id, updates);
        setLocalWord(prev => ({
          ...prev,
          example_sentence: exampleSentence,
        }));
        onWordUpdate?.();
      }
    } catch {
      setPreviousEnrichment(null);
    } finally {
      setEnriching(false);
    }
  };

  const handleUndo = async () => {
    if (!previousEnrichment) return;
    await updateWord(word.id, {
      example_sentence: previousEnrichment.example_sentence,
      context: previousEnrichment.context,
      scaffold_prompt: previousEnrichment.scaffold_prompt,
    });
    setLocalWord(prev => ({
      ...prev,
      example_sentence: previousEnrichment.example_sentence,
      context: previousEnrichment.context,
      scaffold_prompt: previousEnrichment.scaffold_prompt,
    }));
    setPreviousEnrichment(null);
    onWordUpdate?.();
  };

  if (learningMode) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-auto">
        <div className="w-full max-w-md my-auto">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2 text-amber-400">
              <GraduationCap size={16} />
              <span className="text-sm font-medium">Learning mode</span>
            </div>
            <button
              onClick={handleExitLearning}
              className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
            >
              <X size={16} />
              Exit
            </button>
          </div>

          <div className="flashcard">
            <div className={`flashcard-inner ${!showCard ? 'flipped' : ''}`}>
              {/* FRONT — Word Details */}
              <div className="flashcard-front">
                <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 space-y-5">
                  <h2 className="text-2xl font-semibold text-zinc-100">{localWord.word}</h2>

                  <div>
                    <div className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Definition</div>
                    <p className="text-zinc-300 leading-relaxed">{localWord.definition}</p>
                  </div>

                  {localWord.example_sentence && (
                    <div>
                      <div className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Examples</div>
                      <ul className="space-y-2">
                        {localWord.example_sentence.split(' / ').filter(example => {
                          const clean = example.trim().replace('[yours] ', '').toLowerCase();
                          return clean && !clean.startsWith('unable to');
                        }).map((example, i) => {
                          const isYours = example.trim().startsWith('[yours] ');
                          const text = isYours ? example.trim().replace('[yours] ', '') : example.trim();
                          return (
                            <li key={i} className={`italic leading-relaxed pl-3 border-l-2 text-sm ${isYours ? 'border-amber-600/50 text-zinc-300' : 'border-zinc-700 text-zinc-400'}`}>
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

                  {localWord.context && (
                    <div>
                      <div className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Context</div>
                      <p className="text-zinc-400 leading-relaxed text-sm">{localWord.context}</p>
                    </div>
                  )}

                  <button
                    onClick={() => setShowCard(false)}
                    className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors font-medium"
                  >
                    Ready to practice
                  </button>
                </div>
              </div>

              {/* BACK — Practice */}
              <div className="flashcard-back">
                <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-semibold text-zinc-100">{localWord.word}</span>
                    <button
                      onClick={() => setShowCard(true)}
                      className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
                    >
                      <RotateCcw size={14} />
                      Flip card
                    </button>
                  </div>

                  {!feedback && (
                    <>
                      {localWord.user_sentences.length > 0 && !userSentence && (
                        <div className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                          <div className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1.5">Last time you wrote</div>
                          <p className="text-zinc-400 text-sm italic">"{localWord.user_sentences[localWord.user_sentences.length - 1]}"</p>
                        </div>
                      )}

                      <ScaffoldPrompt
                        loading={targetCollocation ? collocationScaffoldLoading : scaffoldLoading}
                        text={targetCollocation
                          ? (collocationScaffold ?? undefined)
                          : (localWord.scaffold_prompt ?? undefined)}
                        fallback={targetCollocation
                          ? `Try using '${targetCollocation.phrase}' in a sentence${targetCollocation.note ? ` — ${targetCollocation.note}` : ''}.`
                          : undefined}
                        loadingLabel={targetCollocation ? 'Generating a prompt...' : 'Generating a prompt to help you...'}
                      />

                      <textarea
                        value={userSentence}
                        onChange={(e) => setUserSentence(e.target.value)}
                        placeholder={targetCollocation ? `${targetCollocation.phrase}...` : 'Write your sentence...'}
                        rows={3}
                        className="w-full px-4 py-3 bg-zinc-800 text-zinc-100 rounded-lg border border-zinc-700 focus:outline-none focus:border-amber-600/50 resize-none text-sm"
                        autoFocus
                        spellCheck
                        autoCorrect="on"
                      />

                      <button
                        onClick={handlePractice}
                        disabled={!userSentence.trim() || evaluating}
                        className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {evaluating ? (
                          <>
                            <Loader2 size={18} className="animate-spin" />
                            Checking...
                          </>
                        ) : 'Submit'}
                      </button>
                    </>
                  )}

                  {feedback && (
                    <SentenceFeedback
                      feedback={feedback}
                      sentence={userSentence}
                      onRate={handleRate}
                      onTryAgain={handleTryAgain}
                      savingRating={savingRating}
                      confirmedDays={confirmedDays}
                      actionsSlot={showUsefulnessPicker ? (
                        <div className="space-y-3 pt-1">
                          <div>
                            <p className="text-xs text-zinc-400 mb-2">
                              Would you actually say{' '}
                              {localWord.collocations?.pairs?.filter(p =>
                                p.phrase.toLowerCase().includes(localWord.word.toLowerCase())
                              )[0]?.phrase
                                ? <span className="text-zinc-200 italic">"{localWord.collocations!.pairs.filter(p => p.phrase.toLowerCase().includes(localWord.word.toLowerCase()))[0].phrase}"</span>
                                : <span className="text-zinc-200 italic">"{localWord.word}"</span>
                              }?
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              {([1, 2, 3, 4] as Usefulness[]).map(u => (
                                <button
                                  key={u}
                                  onClick={() => handleUsefulness(u)}
                                  className="py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs transition-colors text-left border border-zinc-700 hover:border-zinc-500"
                                >
                                  {USEFULNESS_LABELS[u]}
                                </button>
                              ))}
                            </div>
                          </div>
                          {confirmedDays !== null && (
                            <p className="text-xs text-zinc-500 text-center">
                              See you in ~{confirmedDays} day{confirmedDays !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                      ) : undefined}
                    />
                  )}

                  <div className="border-t border-zinc-800 pt-5">
                    <ChatPanel
                      wordId={word.id}
                      word={localWord.word}
                      definition={localWord.definition}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-medium text-zinc-100">{localWord.word}</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-zinc-500 uppercase tracking-wide">Definition</div>
              {!isReadOnly && !editingDefinition && (
                <button
                  onClick={() => { setDefinitionDraft(localWord.definition); setEditingDefinition(true); }}
                  className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  Edit
                </button>
              )}
            </div>
            {editingDefinition ? (
              <div className="space-y-2">
                <textarea
                  value={definitionDraft}
                  onChange={(e) => setDefinitionDraft(e.target.value)}
                  rows={2}
                  autoFocus
                  spellCheck
                  autoCorrect="on"
                  className="w-full px-3 py-2 bg-zinc-800 text-zinc-100 rounded-lg border border-zinc-600 focus:outline-none focus:border-zinc-400 resize-none text-sm leading-relaxed"
                />
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      const trimmed = definitionDraft.trim();
                      await updateWord(word.id, { definition: trimmed });
                      setLocalWord(prev => ({ ...prev, definition: trimmed }));
                      setEditingDefinition(false);
                    }}
                    className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded text-xs transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingDefinition(false)}
                    className="px-3 py-1.5 text-zinc-500 hover:text-zinc-300 text-xs transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-zinc-300 leading-relaxed">{localWord.definition}</p>
                {localWord.word_type === 'word' && localWord.definition && (() => {
                  const synonym = localWord.distinction
                    ? extractSynonym(localWord.distinction, localWord.word)
                    : null;

                  return (
                    <div className="mt-1.5">
                      {/* Collapsed button — shown when null (unchecked) or when user has collapsed */}
                      {(!distinctionExpanded || localWord.distinction == null) && (
                        <button
                          onClick={() => {
                            if (localWord.distinction == null) handleRegenerateDistinction();
                            else setDistinctionExpanded(true);
                          }}
                          disabled={distinctionRegenerating}
                          className="text-zinc-700 hover:text-zinc-500 text-xs transition-colors disabled:opacity-50"
                        >
                          {distinctionRegenerating
                            ? <span className="flex items-center gap-1"><Loader2 size={10} className="animate-spin" />checking...</span>
                            : localWord.distinction == null
                              ? 'How does it differ?'
                              : `How does it differ from ${synonym ?? localWord.word}?`}
                        </button>
                      )}

                      {/* Expanded distinction text */}
                      {distinctionExpanded && localWord.distinction && (
                        <div className="group flex items-start gap-1.5">
                          <div className="flex-1">
                            <button
                              onClick={() => setDistinctionExpanded(false)}
                              className="text-zinc-700 text-[10px] uppercase tracking-wide mr-1.5 hover:text-zinc-500 transition-colors"
                              title="Collapse"
                            >
                              {synonym ? `vs. ${synonym}` : '▲'}
                            </button>
                            <p className="text-zinc-600 text-xs leading-relaxed italic inline">
                              {localWord.distinction}
                            </p>
                          </div>
                          {!isReadOnly && (
                            <button
                              onClick={handleRegenerateDistinction}
                              disabled={distinctionRegenerating}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-700 hover:text-zinc-400 mt-0.5 shrink-0 disabled:opacity-50"
                              title="Regenerate"
                            >
                              {distinctionRegenerating ? <Loader2 size={10} className="animate-spin" /> : <RotateCcw size={10} />}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-zinc-500 uppercase tracking-wide">Examples</div>
              {!isReadOnly && (
                <div className="flex items-center gap-2">
                  {previousEnrichment && (
                    <button
                      onClick={handleUndo}
                      className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                      title="Undo regeneration"
                    >
                      <Undo2 size={12} />
                      Undo
                    </button>
                  )}
                  {localWord.example_sentence && (
                    <button
                      onClick={handleEnrich}
                      disabled={enriching}
                      className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50"
                      title="Generate different examples"
                    >
                      {enriching ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                      Regenerate
                    </button>
                  )}
                </div>
              )}
            </div>
            {enriching && !localWord.example_sentence ? (
              <div className="flex items-center gap-2 text-zinc-500 text-sm py-4">
                <Loader2 size={16} className="animate-spin" />
                Generating examples...
              </div>
            ) : localWord.example_sentence ? (
              <ul className="space-y-2">
                {localWord.example_sentence.split(' / ').filter(example => {
                  const clean = example.trim().replace('[yours] ', '').toLowerCase();
                  return clean && !clean.startsWith('unable to');
                }).map((example, i) => {
                  const isYours = example.trim().startsWith('[yours] ');
                  const text = isYours ? example.trim().replace('[yours] ', '') : example.trim();
                  return (
                    <li key={i} className={`italic leading-relaxed pl-3 border-l-2 ${isYours ? 'border-amber-600/50 text-zinc-300' : 'border-zinc-700 text-zinc-400'}`}>
                      "{text}"
                      {isYours && (
                        <span className="not-italic text-xs ml-2 px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded">yours</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : !isReadOnly ? (
              <button
                onClick={handleEnrich}
                disabled={enriching}
                className="text-zinc-500 hover:text-amber-400 text-sm italic transition-colors flex items-center gap-1.5"
              >
                <Sparkles size={12} />
                Generate examples
              </button>
            ) : null}
          </div>

          <div>
            <div className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Context</div>
            {enriching && !localWord.context ? (
              <div className="flex items-center gap-2 text-zinc-500 text-sm py-2">
                <Loader2 size={14} className="animate-spin" />
                Generating context...
              </div>
            ) : localWord.context ? (
              <p className="text-zinc-400 leading-relaxed">{localWord.context}</p>
            ) : !localWord.example_sentence ? null : (
              <p className="text-zinc-600 text-sm italic">No context available</p>
            )}
            {localWord.word_type === 'word' && localWord.collocations && (() => {
              // Only show pairs that genuinely contain the word itself
              const wordLower = localWord.word.toLowerCase();
              const validPairs = localWord.collocations.pairs.filter(p =>
                p.phrase.toLowerCase().includes(wordLower)
              );
              if (validPairs.length === 0) return null;
              return (
              <div className="mt-3">
                <button
                  onClick={() => setShowCollocations(s => !s)}
                  className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  How it's typically paired {showCollocations ? '↑' : '→'}
                </button>
                {showCollocations && (
                  <div className="mt-3 space-y-2">
                    {validPairs.map((item, i) => (
                      <div key={i} className="text-sm group/pair flex items-start gap-2">
                        <button
                          onClick={() => handleStartLearningWithCollocation(item)}
                          className="text-left"
                          title={`Practice using '${item.phrase}'`}
                        >
                          <span className="text-zinc-300 group-hover/pair:text-amber-300 transition-colors underline underline-offset-2 decoration-zinc-700 group-hover/pair:decoration-amber-600/50">{item.phrase}</span>
                          {item.note && <span className="text-zinc-500 no-underline"> — {item.note}</span>}
                        </button>
                      </div>
                    ))}
                    {localWord.collocations.summary && (
                      <p className="text-zinc-600 text-xs mt-3 leading-relaxed italic">
                        {localWord.collocations.summary}
                      </p>
                    )}
                  </div>
                )}
              </div>
              );
            })()}
          </div>

          {localWord.user_sentences.length > 0 && (
            <div>
              <div className="text-xs text-zinc-500 uppercase tracking-wide mb-2">
                Your Practice ({localWord.user_sentences.length})
              </div>
              <ul className="space-y-2">
                {localWord.user_sentences.map((sentence, i) => (
                  <li key={i} className="text-zinc-400 text-sm pl-3 border-l-2 border-zinc-700">
                    {sentence}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {localWord.source_tag && (
            <div className="pt-4 border-t border-zinc-800">
              {(() => {
                const color = getTagColor(localWord.source_tag);
                return (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs ${color.bg} ${color.text} border ${color.border}`}>
                    <BookMarked size={12} />
                    {localWord.source_tag}
                  </span>
                );
              })()}
            </div>
          )}

          {/* Usefulness toggle — always editable */}
          {!isReadOnly && (
            <div className="pt-4 border-t border-zinc-800 space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {([1, 2, 3, 4] as Usefulness[]).map(u => (
                  <button
                    key={u}
                    onClick={async () => {
                      setLocalWord(prev => ({ ...prev, usefulness: u }));
                      await updateWord(word.id, { usefulness: u });
                      onWordUpdate?.();
                    }}
                    className={`px-2.5 py-1 rounded-md text-xs transition-colors border ${
                      (localWord.usefulness ?? 2) === u
                        ? 'bg-zinc-700 text-zinc-100 border-zinc-500'
                        : 'bg-transparent text-zinc-600 border-zinc-800 hover:text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    {USEFULNESS_LABELS[u]}
                  </button>
                ))}
              </div>
              {/* Add to review queue / next due date */}
              {setReviewDate && (
                localWord.next_review_at ? (
                  <p className="text-xs text-zinc-600">
                    Due {new Date(localWord.next_review_at) <= new Date()
                      ? 'now'
                      : `${Math.ceil((new Date(localWord.next_review_at).getTime() - Date.now()) / 86400000)} day${
                          Math.ceil((new Date(localWord.next_review_at).getTime() - Date.now()) / 86400000) !== 1 ? 's' : ''
                        }`}
                  </p>
                ) : (
                  <button
                    onClick={async () => {
                      const now = new Date().toISOString();
                      setLocalWord(prev => ({ ...prev, next_review_at: now }));
                      await setReviewDate(word.id, now);
                      onWordUpdate?.();
                    }}
                    className="text-xs text-zinc-600 hover:text-amber-400 transition-colors"
                  >
                    + Add to review queue
                  </button>
                )
              )}
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-zinc-600 pt-4 border-t border-zinc-800">
            <span>Practiced {localWord.practice_count} times</span>
            <div className="flex items-center gap-3">
              {!isReadOnly && (
                <button
                  onClick={async () => {
                    const next = !localWord.is_public;
                    setLocalWord(prev => ({ ...prev, is_public: next }));
                    await updateWord(word.id, { is_public: next });
                  }}
                  title={localWord.is_public ? 'Visible to visitors — click to make private' : 'Private — click to make public'}
                  className={`flex items-center gap-1 transition-colors ${
                    localWord.is_public ? 'text-emerald-500 hover:text-emerald-400' : 'text-zinc-600 hover:text-zinc-400'
                  }`}
                >
                  {localWord.is_public ? <Globe size={12} /> : <Lock size={12} />}
                  {localWord.is_public ? 'Public' : 'Private'}
                </button>
              )}
              <span className="capitalize">{localWord.category.replace('_', ' ').toLowerCase()}</span>
            </div>
          </div>

          {canLearn && (
            <div className="flex justify-center">
              <button
                onClick={handleStartLearning}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 rounded-lg transition-colors border border-amber-600/30 text-sm"
              >
                <GraduationCap size={16} />
                Ready to practice
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
