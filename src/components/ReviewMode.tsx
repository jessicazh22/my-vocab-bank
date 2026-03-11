import { useState, useEffect, useMemo, useRef } from 'react';
import { VocabularyWord, ChatMessage } from '../lib/supabase';
import { useVocabulary, useWordChat } from '../lib/hooks';
import { X, Sparkles, Loader2, Send, MessageCircle } from 'lucide-react';

type ReviewType = 'learn' | 'revise';

interface ReviewModeProps {
  words: VocabularyWord[];
  mode: ReviewType;
  onClose: () => void;
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

export default function ReviewMode({ words, mode, onClose }: ReviewModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showContent, setShowContent] = useState(false);
  const [userSentence, setUserSentence] = useState('');
  const [currentPrompt, setCurrentPrompt] = useState(getRandomPrompt);
  const [reviseNote, setReviseNote] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const { practiceWord } = useVocabulary();

  const reviewWords = mode === 'learn'
    ? words.filter((w) => (w.category === 'LEARNING' || w.category === 'JUST_ADDED') && w.word_type !== 'sentence')
    : words.filter((w) => w.word_type === 'sentence' || w.familiarity === 'NEED_TO_USE');

  const currentWord = useMemo(() => {
    return reviewWords[currentIndex];
  }, [reviewWords, currentIndex]);

  const { chatHistory, saveChat, clearChat, loading: chatLoading } = useWordChat(
    mode === 'revise' && currentWord ? currentWord.id : null
  );

  useEffect(() => {
    if (reviewWords.length === 0) {
      onClose();
    }
  }, [reviewWords.length, onClose]);

  if (reviewWords.length === 0 || !currentWord) {
    return null;
  }

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const goToNext = () => {
    setUserSentence('');
    setReviseNote('');
    clearChat();
    setShowContent(false);
    setCurrentPrompt(getRandomPrompt());

    if (currentIndex < reviewWords.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onClose();
    }
  };

  const handleNext = async () => {
    if (mode === 'learn') {
      if (!userSentence.trim()) return;
      await practiceWord(currentWord.id, userSentence);
    }
    goToNext();
  };

  const handleSubmitNote = () => {
    goToNext();
  };

  const handleSkip = () => {
    goToNext();
  };

  const handleNotForMe = () => {
    goToNext();
  };

  const askAI = async () => {
    if (!reviseNote.trim()) return;
    const userMessage = reviseNote.trim();
    setReviseNote('');
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
          word: currentWord.word,
          definition: currentWord.definition,
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

  const isSentence = currentWord.word_type === 'sentence';

  return (
    <div className="fixed inset-0 bg-zinc-900 z-50 overflow-auto">
      <div className="min-h-screen flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-500">
              {currentIndex + 1} / {reviewWords.length}
            </span>
            <span className={`text-xs px-2 py-1 rounded ${mode === 'learn' ? 'bg-amber-900/30 text-amber-400' : 'bg-teal-900/30 text-teal-400'}`}>
              {mode === 'learn' ? 'Learn' : 'Revise'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-2xl space-y-8">
            <div className="text-center">
              <h1 className={`font-light text-zinc-100 mb-6 ${isSentence ? 'text-2xl md:text-3xl leading-relaxed' : 'text-4xl'}`}>
                {currentWord.word}
              </h1>

              {mode === 'learn' && currentWord.scaffold_prompt && !showContent && (
                <p className="text-zinc-400 text-lg mb-8 leading-relaxed max-w-xl mx-auto">
                  {currentWord.scaffold_prompt}
                </p>
              )}

              {mode === 'revise' && !showContent && (
                <p className="text-zinc-400 text-lg mb-8 italic">
                  {currentPrompt.prompt}
                </p>
              )}

              {!showContent ? (
                <button
                  onClick={() => setShowContent(true)}
                  className="px-8 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg transition-colors border border-zinc-700"
                >
                  {mode === 'learn' ? 'Show definition' : "I've thought about it"}
                </button>
              ) : (
                <div className="space-y-6">
                  {mode === 'learn' && (
                    <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6 text-left">
                      <p className="text-zinc-300 text-lg leading-relaxed mb-4">
                        {currentWord.definition}
                      </p>
                      {currentWord.example_sentence && (
                        <p className="text-zinc-500 italic leading-relaxed">
                          "{currentWord.example_sentence}"
                        </p>
                      )}
                    </div>
                  )}

                  {mode === 'revise' && (
                    <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6 text-left space-y-4">
                      {currentWord.definition && (
                        <div>
                          <p className="text-zinc-500 text-xs uppercase tracking-wide mb-2">Meaning</p>
                          <p className="text-zinc-200 leading-relaxed">
                            {currentWord.definition}
                          </p>
                        </div>
                      )}

                      {currentWord.usage_hint && (
                        <div>
                          <p className="text-zinc-500 text-xs uppercase tracking-wide mb-2">When to use</p>
                          <p className="text-teal-400/90 leading-relaxed">
                            {currentWord.usage_hint}
                          </p>
                        </div>
                      )}

                      {currentWord.context && (
                        <div>
                          <p className="text-zinc-500 text-xs uppercase tracking-wide mb-2">Context</p>
                          <p className="text-zinc-400 leading-relaxed">
                            {currentWord.context}
                          </p>
                        </div>
                      )}

                      {currentWord.example_sentence && !isSentence && (
                        <div>
                          <p className="text-zinc-500 text-xs uppercase tracking-wide mb-2">Example</p>
                          <p className="text-zinc-400 italic leading-relaxed">
                            "{currentWord.example_sentence}"
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {mode === 'learn' && (
                    <div className="text-left">
                      <label className="block text-zinc-400 text-sm mb-3">
                        Use it in a sentence:
                      </label>
                      <textarea
                        value={userSentence}
                        onChange={(e) => setUserSentence(e.target.value)}
                        placeholder="Write your own sentence..."
                        rows={4}
                        className="w-full px-4 py-3 bg-zinc-800 text-zinc-100 rounded-lg border border-zinc-700 focus:outline-none focus:border-zinc-500 resize-none"
                        autoFocus
                      />
                    </div>
                  )}

                  {mode === 'learn' && (
                    <button
                      onClick={handleNext}
                      disabled={!userSentence.trim()}
                      className="w-full py-3 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      I used it
                    </button>
                  )}

                  {mode === 'revise' && (
                    <div className="space-y-4">
                      {chatLoading && (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 size={20} className="animate-spin text-zinc-500" />
                        </div>
                      )}
                      {!chatLoading && chatHistory.length > 0 && (
                        <div className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
                          <MessageCircle size={12} />
                          <span>Previous conversation</span>
                        </div>
                      )}
                      {!chatLoading && chatHistory.length > 0 && (
                        <div
                          ref={chatContainerRef}
                          className="max-h-64 overflow-y-auto space-y-3 text-left"
                        >
                          {chatHistory.map((msg, idx) => (
                            <div
                              key={idx}
                              className={`p-3 rounded-lg ${
                                msg.role === 'user'
                                  ? 'bg-zinc-700/50 border border-zinc-600 ml-8'
                                  : 'bg-teal-900/20 border border-teal-800/50 mr-8'
                              }`}
                            >
                              <p className={`text-sm leading-relaxed ${
                                msg.role === 'user' ? 'text-zinc-200' : 'text-teal-300/90'
                              }`}>
                                {msg.content}
                              </p>
                            </div>
                          ))}
                          {aiLoading && (
                            <div className="bg-teal-900/20 border border-teal-800/50 mr-8 p-3 rounded-lg">
                              <Loader2 size={16} className="animate-spin text-teal-400" />
                            </div>
                          )}
                        </div>
                      )}

                      {!chatLoading && <div className="text-left">
                        <label className="block text-zinc-400 text-sm mb-3">
                          {chatHistory.length > 0 ? 'Continue the conversation:' : 'Ask a question:'}
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={reviseNote}
                            onChange={(e) => setReviseNote(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && askAI()}
                            placeholder={chatHistory.length > 0 ? "Follow up..." : "What does this mean? How would I use it?"}
                            className="w-full px-4 py-3 bg-zinc-800 text-zinc-100 rounded-lg border border-zinc-700 focus:outline-none focus:border-zinc-500 pr-12"
                          />
                          <button
                            onClick={askAI}
                            disabled={!reviseNote.trim() || aiLoading}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-zinc-500 hover:text-teal-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Send message"
                          >
                            {chatHistory.length > 0 ? (
                              <Send size={18} />
                            ) : (
                              <Sparkles size={18} />
                            )}
                          </button>
                        </div>
                      </div>}

                      <div className="flex gap-3">
                        <button
                          onClick={handleSubmitNote}
                          className="flex-1 py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors font-medium"
                        >
                          Done
                        </button>
                        <button
                          onClick={handleSkip}
                          className="flex-1 py-3 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-lg transition-colors"
                        >
                          Skip
                        </button>
                      </div>

                      <button
                        onClick={handleNotForMe}
                        className="w-full text-zinc-500 hover:text-zinc-400 text-sm transition-colors py-2"
                      >
                        Not for me
                      </button>
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
