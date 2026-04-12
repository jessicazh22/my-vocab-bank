import { useState, useEffect, useMemo } from 'react';
import { VocabularyWord } from '../lib/supabase';
import { X } from 'lucide-react';
import ChatPanel from './ChatPanel';

type ReviewType = 'learn' | 'revise';

interface ReviewModeProps {
  words: VocabularyWord[];
  mode: ReviewType;
  onClose: () => void;
  practiceWord: (id: string, userSentence: string) => Promise<void>;
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

export default function ReviewMode({ words, mode, onClose, practiceWord }: ReviewModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showContent, setShowContent] = useState(false);
  const [userSentence, setUserSentence] = useState('');
  const [currentPrompt, setCurrentPrompt] = useState(getRandomPrompt);

  const reviewWords = mode === 'learn'
    ? words.filter((w) => (w.category === 'LEARNING' || w.category === 'JUST_ADDED') && w.word_type !== 'sentence')
    : words.filter((w) => w.word_type === 'sentence' || w.familiarity === 'NEED_TO_USE');

  const currentWord = useMemo(() => reviewWords[currentIndex], [reviewWords, currentIndex]);

  useEffect(() => {
    if (reviewWords.length === 0) onClose();
  }, [reviewWords.length, onClose]);

  if (reviewWords.length === 0 || !currentWord) return null;

  const goToNext = () => {
    setUserSentence('');
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
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-100 transition-colors">
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
                <p className="text-zinc-400 text-lg mb-8 italic">{currentPrompt.prompt}</p>
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
                      <p className="text-zinc-300 text-lg leading-relaxed mb-4">{currentWord.definition}</p>
                      {currentWord.example_sentence && (
                        <p className="text-zinc-500 italic leading-relaxed">"{currentWord.example_sentence}"</p>
                      )}
                    </div>
                  )}

                  {mode === 'revise' && (
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
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
