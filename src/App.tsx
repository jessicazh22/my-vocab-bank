import { useState } from 'react';
import { useAuth, useVocabulary } from './lib/hooks';
import Auth from './components/Auth';
import WordBank from './components/WordBank';
import QuickAdd from './components/QuickAdd';
import ReviewMode from './components/ReviewMode';
import ReviewModeSelector from './components/ReviewModeSelector';
import { Plus, Play, LogOut } from 'lucide-react';

function App() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { words, loading: wordsLoading, updateWord, deleteWord } = useVocabulary();
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [showLearn, setShowLearn] = useState(false);
  const [showRevise, setShowRevise] = useState(false);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <div className="text-zinc-500">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  const learnWords = words.filter(
    (w) => (w.category === 'LEARNING' || w.category === 'JUST_ADDED') && w.word_type !== 'sentence'
  );

  const reviseItems = words.filter(
    (w) => w.word_type === 'sentence' || w.familiarity === 'NEED_TO_USE'
  );

  const totalReviewable = learnWords.length + reviseItems.length;

  return (
    <div className="min-h-screen bg-zinc-900">
      <header className="border-b border-zinc-800 sticky top-0 bg-zinc-900/95 backdrop-blur z-40">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-light text-zinc-100">Vocabulary</h1>

            <div className="flex items-center gap-3">
              {totalReviewable > 0 && (
                <button
                  onClick={() => setShowModeSelector(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg transition-colors"
                >
                  <Play size={18} />
                  Review
                </button>
              )}

              <button
                onClick={() => setShowQuickAdd(true)}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-lg transition-colors"
              >
                <Plus size={18} />
                Add Word
              </button>

              <button
                onClick={signOut}
                className="p-2 text-zinc-400 hover:text-zinc-100 transition-colors"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {wordsLoading ? (
          <div className="text-center text-zinc-500">Loading your words...</div>
        ) : words.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-zinc-500 mb-4">No words yet</p>
            <button
              onClick={() => setShowQuickAdd(true)}
              className="text-zinc-400 hover:text-zinc-100 underline"
            >
              Add your first word
            </button>
          </div>
        ) : (
          <WordBank words={words} updateWord={updateWord} deleteWord={deleteWord} />
        )}
      </main>

      {showQuickAdd && <QuickAdd onClose={() => setShowQuickAdd(false)} />}
      {showModeSelector && (
        <ReviewModeSelector
          learnCount={learnWords.length}
          reviseCount={reviseItems.length}
          onSelectLearn={() => {
            setShowModeSelector(false);
            setShowLearn(true);
          }}
          onSelectRevise={() => {
            setShowModeSelector(false);
            setShowRevise(true);
          }}
          onClose={() => setShowModeSelector(false)}
        />
      )}
      {showLearn && <ReviewMode words={words} mode="learn" onClose={() => setShowLearn(false)} />}
      {showRevise && <ReviewMode words={words} mode="revise" onClose={() => setShowRevise(false)} />}
    </div>
  );
}

export default App;
