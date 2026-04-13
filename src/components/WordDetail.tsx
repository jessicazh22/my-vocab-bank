import { useState, useEffect } from 'react';
import { X, BookMarked, GraduationCap, Loader2, RefreshCw, Undo2, Check, Sparkles, RotateCcw, Globe, Lock } from 'lucide-react';
import { VocabularyWord, callEdgeFunction } from '../lib/supabase';
import { getTagColor } from '../lib/utils';
import ChatPanel from './ChatPanel';

interface WordDetailProps {
  word: VocabularyWord;
  onClose: () => void;
  onWordUpdate?: () => void;
  updateWord: (id: string, updates: Partial<VocabularyWord>) => Promise<void>;
  practiceWord: (id: string, userSentence: string) => Promise<void>;
  isReadOnly?: boolean;
}

interface PreviousEnrichment {
  example_sentence: string;
  context: string;
  scaffold_prompt?: string;
}

interface Feedback {
  correct: boolean;
  feedback: string;
  suggestion?: string | null;
}

export default function WordDetail({ word, onClose, onWordUpdate, updateWord, practiceWord, isReadOnly = false }: WordDetailProps) {
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

  useEffect(() => {
    setLocalWord(word);
  }, [word]);

  const canLearn = localWord.word_type !== 'sentence';

  const getOriginalExample = (exampleStr: string | undefined): string | null => {
    if (!exampleStr) return null;
    const parts = exampleStr.split(' / ');
    const yours = parts.find(p => p.startsWith('[yours] '));
    return yours ? yours.replace('[yours] ', '') : null;
  };

  const handleStartLearning = async () => {
    setLearningMode(true);
    setShowCard(false);
    setFeedback(null);
    setUserSentence('');

    if (!localWord.scaffold_prompt) {
      setScaffoldLoading(true);
      try {
        const needsFullEnrich = !localWord.example_sentence || !localWord.context;
        const data = await callEdgeFunction<any>('enrich-word', {
          word: localWord.word,
          definition: localWord.definition,
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

  const handleExitLearning = () => {
    setLearningMode(false);
    setShowCard(false);
    setFeedback(null);
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
      if (data.examples && data.context) {
        const maxAi = userOriginal ? 2 : 3;
        const aiExamples = data.examples.slice(0, maxAi).join(' / ');
        const exampleSentence = userOriginal
          ? `[yours] ${userOriginal} / ${aiExamples}`
          : aiExamples;
        const updates: Partial<VocabularyWord> = {
          example_sentence: exampleSentence,
          context: data.context,
          ...(data.scaffoldPrompt && { scaffold_prompt: data.scaffoldPrompt }),
        };
        await updateWord(word.id, updates);
        setLocalWord(prev => ({
          ...prev,
          example_sentence: exampleSentence,
          context: data.context,
          scaffold_prompt: data.scaffoldPrompt || prev.scaffold_prompt,
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
                        {localWord.example_sentence.split(' / ').map((example, i) => {
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

                      {scaffoldLoading ? (
                        <div className="p-4 bg-amber-900/10 border border-amber-800/20 rounded-lg flex items-center gap-2">
                          <Loader2 size={14} className="animate-spin text-amber-400" />
                          <p className="text-amber-200/60 text-sm">Generating a prompt to help you...</p>
                        </div>
                      ) : localWord.scaffold_prompt ? (
                        <div className="p-4 bg-amber-900/10 border border-amber-800/20 rounded-lg">
                          <p className="text-amber-200/80 text-sm leading-relaxed">{localWord.scaffold_prompt}</p>
                        </div>
                      ) : null}

                      <textarea
                        value={userSentence}
                        onChange={(e) => setUserSentence(e.target.value)}
                        placeholder="Write your sentence..."
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
                    <div className="space-y-4">
                      <div className={`p-4 rounded-xl border ${feedback.correct ? 'bg-emerald-900/20 border-emerald-700/50' : 'bg-rose-900/20 border-rose-700/50'}`}>
                        <div className="flex items-start gap-3">
                          <div className={`p-1.5 rounded-full shrink-0 ${feedback.correct ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                            {feedback.correct ? <Check size={14} className="text-white" /> : <X size={14} className="text-white" />}
                          </div>
                          <div className="space-y-2">
                            <p className={`font-medium ${feedback.correct ? 'text-emerald-300' : 'text-rose-300'}`}>
                              {feedback.correct ? 'Great job!' : 'Not quite'}
                            </p>
                            <p className="text-zinc-400 text-sm leading-relaxed">{feedback.feedback}</p>
                            {feedback.suggestion && (
                              <p className="text-zinc-500 text-sm leading-relaxed border-t border-zinc-700/50 pt-2 mt-2">{feedback.suggestion}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="bg-zinc-800/30 rounded-lg p-3">
                        <div className="text-xs text-zinc-500 mb-1">Your sentence:</div>
                        <p className="text-zinc-400 text-sm italic">"{userSentence}"</p>
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={handleTryAgain}
                          className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors font-medium"
                        >
                          Edit & resubmit
                        </button>
                        <button
                          onClick={handleExitLearning}
                          className="flex-1 py-3 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-lg transition-colors font-medium"
                        >
                          Done
                        </button>
                      </div>
                    </div>
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
              <p className="text-zinc-300 leading-relaxed">{localWord.definition}</p>
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
                {localWord.example_sentence.split(' / ').map((example, i) => {
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
