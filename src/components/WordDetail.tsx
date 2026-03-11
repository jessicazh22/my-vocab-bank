import { useState, useEffect, useRef } from 'react';
import { X, BookMarked, GraduationCap, Loader2, RefreshCw, Undo2, Check, Send, Sparkles, MessageCircle, BookOpen } from 'lucide-react';
import { VocabularyWord, ChatMessage } from '../lib/supabase';
import { useVocabulary, useWordChat } from '../lib/hooks';

const SOURCE_TAG_COLORS = [
  { bg: 'bg-rose-500/20', text: 'text-rose-300', border: 'border-rose-500/30' },
  { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/30' },
  { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  { bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-500/30' },
  { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/30' },
  { bg: 'bg-fuchsia-500/20', text: 'text-fuchsia-300', border: 'border-fuchsia-500/30' },
];

function getTagColor(tag: string) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return SOURCE_TAG_COLORS[Math.abs(hash) % SOURCE_TAG_COLORS.length];
}

interface WordDetailProps {
  word: VocabularyWord;
  onClose: () => void;
  onWordUpdate?: () => void;
}

interface PreviousEnrichment {
  example_sentence: string;
  context: string;
  scaffold_prompt?: string;
}

interface Feedback {
  correct: boolean;
  feedback: string;
}

export default function WordDetail({ word, onClose, onWordUpdate }: WordDetailProps) {
  const [learningMode, setLearningMode] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [userSentence, setUserSentence] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [localWord, setLocalWord] = useState(word);
  const [previousEnrichment, setPreviousEnrichment] = useState<PreviousEnrichment | null>(null);
  const [hasAutoEnriched, setHasAutoEnriched] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const { practiceWord, updateWord } = useVocabulary();
  const { chatHistory, saveChat, loading: chatLoading } = useWordChat(learningMode ? word.id : null);

  useEffect(() => {
    setLocalWord(word);
  }, [word]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  useEffect(() => {
    const needsEnrichment = !localWord.example_sentence || !localWord.context;
    if (needsEnrichment && !hasAutoEnriched && !enriching) {
      setHasAutoEnriched(true);
      handleEnrich();
    }
  }, [localWord.id]);

  const canLearn = (localWord.category === 'LEARNING' || localWord.category === 'JUST_ADDED') &&
                   localWord.familiarity === 'NEED_TO_LEARN' &&
                   localWord.word_type !== 'sentence';

  const handleStartLearning = () => {
    setLearningMode(true);
    setShowCard(false);
    setFeedback(null);
    setUserSentence('');
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
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evaluate-sentence`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          word: localWord.word,
          definition: localWord.definition,
          sentence: userSentence,
        }),
      });
      const data = await response.json();
      setFeedback(data);

      if (data.correct) {
        await practiceWord(word.id, userSentence);
        onWordUpdate?.();
      }
    } catch {
      setFeedback({ correct: true, feedback: 'Great practice!' });
      await practiceWord(word.id, userSentence);
      onWordUpdate?.();
    } finally {
      setEvaluating(false);
    }
  };

  const handleTryAgain = () => {
    setFeedback(null);
    setUserSentence('');
  };

  const handleAskAI = async () => {
    if (!chatInput.trim()) return;
    const userMessage = chatInput.trim();
    setChatInput('');
    const newHistory: ChatMessage[] = [...chatHistory, { role: 'user', content: userMessage }];
    await saveChat(newHistory);
    setAiLoading(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ask-vocabulary`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          word: localWord.word,
          definition: localWord.definition,
          question: userMessage,
          history: chatHistory,
        }),
      });
      const data = await response.json();
      if (data.answer) {
        const updatedHistory: ChatMessage[] = [...newHistory, { role: 'assistant', content: data.answer }];
        await saveChat(updatedHistory);
      }
    } catch {
      const errorHistory: ChatMessage[] = [...newHistory, { role: 'assistant', content: 'Unable to get a response. Try again later.' }];
      await saveChat(errorHistory);
    } finally {
      setAiLoading(false);
    }
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
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enrich-word`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          word: localWord.word,
          definition: localWord.definition,
        }),
      });
      const data = await response.json();
      if (data.examples && data.context) {
        const exampleSentence = data.examples.join(' / ');
        const updates: Partial<VocabularyWord> = {
          example_sentence: exampleSentence,
          context: data.context,
        };
        if (data.scaffoldPrompt) {
          updates.scaffold_prompt = data.scaffoldPrompt;
        }
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
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className={`w-full transition-all duration-300 ${showCard ? 'max-w-4xl' : 'max-w-md'}`}>
          <button
            onClick={handleExitLearning}
            className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X size={24} />
          </button>

          <div className={`flex gap-4 ${showCard ? 'flex-row' : 'flex-col'}`}>
            {showCard && (
              <div className="w-80 flex-shrink-0 bg-zinc-900 border border-zinc-700 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500 uppercase tracking-wide">Reference</span>
                  <button
                    onClick={() => setShowCard(false)}
                    className="text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-zinc-100 mb-2">{localWord.word}</h3>
                  <p className="text-zinc-300 text-sm leading-relaxed">{localWord.definition}</p>
                </div>
                {localWord.context && (
                  <div>
                    <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Context</div>
                    <p className="text-zinc-400 text-sm leading-relaxed">{localWord.context}</p>
                  </div>
                )}
                {localWord.example_sentence && (
                  <div>
                    <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Examples</div>
                    <ul className="space-y-1.5">
                      {localWord.example_sentence.split(' / ').slice(0, 2).map((example, i) => (
                        <li key={i} className="text-zinc-400 text-sm italic pl-2 border-l-2 border-zinc-700">
                          "{example.trim()}"
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="flex-1 bg-zinc-900 border border-zinc-700 rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-400">
                  <GraduationCap size={20} />
                  <span className="font-medium">Use it in a sentence</span>
                </div>
                {!showCard && (
                  <button
                    onClick={() => setShowCard(true)}
                    className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
                  >
                    <BookOpen size={14} />
                    Show card
                  </button>
                )}
              </div>

              {!showCard && (
                <div className="text-center py-2">
                  <span className="text-2xl font-semibold text-zinc-100">{localWord.word}</span>
                </div>
              )}

              {!feedback && (
                <>
                  {localWord.scaffold_prompt && (
                    <div className="p-4 bg-amber-900/10 border border-amber-800/20 rounded-lg">
                      <p className="text-amber-200/80 text-sm leading-relaxed">{localWord.scaffold_prompt}</p>
                    </div>
                  )}

                  <div>
                    <textarea
                      value={userSentence}
                      onChange={(e) => setUserSentence(e.target.value)}
                      placeholder="Write your sentence..."
                      rows={3}
                      className="w-full px-4 py-3 bg-zinc-800 text-zinc-100 rounded-lg border border-zinc-700 focus:outline-none focus:border-amber-600/50 resize-none text-sm"
                      autoFocus
                    />
                  </div>

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
                    ) : (
                      'Submit'
                    )}
                  </button>
                </>
              )}

              {feedback && (
                <div className="space-y-4">
                  <div className={`p-4 rounded-xl border ${
                    feedback.correct
                      ? 'bg-emerald-900/20 border-emerald-700/50'
                      : 'bg-rose-900/20 border-rose-700/50'
                  }`}>
                    <div className="flex items-start gap-3">
                      <div className={`p-1.5 rounded-full ${
                        feedback.correct ? 'bg-emerald-600' : 'bg-rose-600'
                      }`}>
                        {feedback.correct ? <Check size={14} className="text-white" /> : <X size={14} className="text-white" />}
                      </div>
                      <div>
                        <p className={`font-medium ${
                          feedback.correct ? 'text-emerald-300' : 'text-rose-300'
                        }`}>
                          {feedback.correct ? 'Great job!' : 'Not quite'}
                        </p>
                        <p className="text-zinc-400 text-sm mt-1">{feedback.feedback}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-zinc-800/50 rounded-lg p-3">
                    <div className="text-xs text-zinc-500 mb-1">Your sentence:</div>
                    <p className="text-zinc-300 text-sm">{userSentence}</p>
                  </div>

                  {feedback.correct ? (
                    <button
                      onClick={handleExitLearning}
                      className="w-full py-3 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-lg transition-colors font-medium"
                    >
                      Done
                    </button>
                  ) : (
                    <button
                      onClick={handleTryAgain}
                      className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors font-medium"
                    >
                      Try again
                    </button>
                  )}
                </div>
              )}

              <div className="border-t border-zinc-800 pt-5">
                <div className="flex items-center gap-2 text-zinc-400 mb-3">
                  <MessageCircle size={14} />
                  <span className="text-xs uppercase tracking-wide">Ask AI about this word</span>
                </div>

                {chatLoading && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 size={18} className="animate-spin text-zinc-500" />
                  </div>
                )}

                {!chatLoading && chatHistory.length > 0 && (
                  <div
                    ref={chatContainerRef}
                    className="max-h-48 overflow-y-auto space-y-2 mb-3"
                  >
                    {chatHistory.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-lg text-sm ${
                          msg.role === 'user'
                            ? 'bg-zinc-700/50 border border-zinc-600 ml-6'
                            : 'bg-amber-900/20 border border-amber-800/30 mr-6'
                        }`}
                      >
                        <p className={`leading-relaxed ${
                          msg.role === 'user' ? 'text-zinc-200' : 'text-amber-300/90'
                        }`}>
                          {msg.content}
                        </p>
                      </div>
                    ))}
                    {aiLoading && (
                      <div className="bg-amber-900/20 border border-amber-800/30 mr-6 p-2.5 rounded-lg">
                        <Loader2 size={14} className="animate-spin text-amber-400" />
                      </div>
                    )}
                  </div>
                )}

                {!chatLoading && (
                  <div className="relative">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAskAI()}
                      placeholder={chatHistory.length > 0 ? "Follow up..." : "How would I use this naturally?"}
                      className="w-full px-4 py-2.5 bg-zinc-800 text-zinc-100 rounded-lg border border-zinc-700 focus:outline-none focus:border-amber-600/50 pr-10 text-sm"
                    />
                    <button
                      onClick={handleAskAI}
                      disabled={!chatInput.trim() || aiLoading}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-zinc-500 hover:text-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {chatHistory.length > 0 ? (
                        <Send size={16} />
                      ) : (
                        <Sparkles size={16} />
                      )}
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={handleExitLearning}
                className="w-full text-zinc-500 hover:text-zinc-400 text-sm transition-colors py-1"
              >
                Exit learning mode
              </button>
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
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <div className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Definition</div>
            <p className="text-zinc-300 leading-relaxed">{localWord.definition}</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-zinc-500 uppercase tracking-wide">Examples</div>
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
                    {enriching ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <RefreshCw size={12} />
                    )}
                    Regenerate
                  </button>
                )}
              </div>
            </div>
            {enriching && !localWord.example_sentence ? (
              <div className="flex items-center gap-2 text-zinc-500 text-sm py-4">
                <Loader2 size={16} className="animate-spin" />
                Generating examples...
              </div>
            ) : localWord.example_sentence ? (
              <ul className="space-y-2">
                {localWord.example_sentence.split(' / ').map((example, i) => (
                  <li key={i} className="text-zinc-400 italic leading-relaxed pl-3 border-l-2 border-zinc-700">
                    "{example.trim()}"
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-zinc-600 text-sm italic">No examples available</p>
            )}
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
            ) : (
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
            <span className="capitalize">{localWord.category.replace('_', ' ').toLowerCase()}</span>
          </div>

          {canLearn && (
            <button
              onClick={handleStartLearning}
              className="w-full flex items-center justify-center gap-2 py-3 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 rounded-lg transition-colors border border-amber-600/30"
            >
              <GraduationCap size={18} />
              Start Learning
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
