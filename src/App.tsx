import { useState, useEffect, useRef } from 'react';
import { useAuth, useVocabulary, useLocale } from './lib/hooks';
import Auth from './components/Auth';
import WordBank from './components/WordBank';
import QuickAdd from './components/QuickAdd';
import ReviewMode from './components/ReviewMode';
import ReviewModeSelector from './components/ReviewModeSelector';
import WeeklyReview, { UsageLogEntry } from './components/WeeklyReview';
import GrammarModule from './components/GrammarModule';
import { Plus, LogOut, Settings, BookOpenCheck, BookOpen, Mic, Library } from 'lucide-react';
// Hidden imports (This week + Practice — hidden from UI, keep for potential restoration)
// import { Play, Zap } from 'lucide-react';

// --- Weekly state helpers ---
const WEEKLY_KEY = 'weekly-challenge';

function getThisMonday() {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

interface WeeklyState {
  selected: string[];
  wordLogs: { [wordId: string]: UsageLogEntry[] };
  weekStart: string;
}

function loadWeeklyState(): WeeklyState {
  try {
    const raw = localStorage.getItem(WEEKLY_KEY);
    if (!raw) return { selected: [], wordLogs: {}, weekStart: getThisMonday() };
    const parsed = JSON.parse(raw);
    if (parsed.weekStart !== getThisMonday()) return { selected: [], wordLogs: {}, weekStart: getThisMonday() };
    // Backward compat: migrate old `done` array to `wordLogs`
    if (parsed.done && !parsed.wordLogs) {
      const wordLogs: { [id: string]: UsageLogEntry[] } = {};
      (parsed.done as { id: string; sentence?: string }[]).forEach(d => {
        wordLogs[d.id] = [{ timestamp: new Date().toISOString(), sentence: d.sentence }];
      });
      return { selected: parsed.selected || [], wordLogs, weekStart: parsed.weekStart };
    }
    return { selected: parsed.selected || [], wordLogs: parsed.wordLogs || {}, weekStart: parsed.weekStart };
  } catch {
    return { selected: [], wordLogs: {}, weekStart: getThisMonday() };
  }
}

function saveWeeklyState(state: WeeklyState) {
  localStorage.setItem(WEEKLY_KEY, JSON.stringify(state));
}

function App() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { words, loading: wordsLoading, addWord, checkDuplicate, updateWord, deleteWord, archiveWord, unarchiveWord, bulkArchiveWords, practiceWord, setReviewDate } = useVocabulary();
  const { locale, setLocale } = useLocale();
  const [activeModule, setActiveModule]   = useState<'vocabulary' | 'grammar'>('vocabulary');
  const [grammarView,  setGrammarView]    = useState<'coach' | 'sessions'>('coach');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [showLearn, setShowLearn] = useState(false);
  const [showRevise, setShowRevise] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showQueueSelect, setShowQueueSelect] = useState(false);
  const [queueSelected, setQueueSelected] = useState<string[]>([]);
  const [showAuth, setShowAuth] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showSettings) return;
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSettings]);

  // Weekly state: 'off' | 'select' | 'review'
  const [weeklyView, setWeeklyView] = useState<'off' | 'select' | 'review'>('off');
  const [weeklyState, setWeeklyState] = useState<WeeklyState>(loadWeeklyState);

  useEffect(() => {
    saveWeeklyState(weeklyState);
  }, [weeklyState]);

  const handleWeeklyButtonClick = () => {
    if (weeklyView !== 'off') { setWeeklyView('off'); return; }
    // If words already selected → review mode; else → select mode
    setWeeklyView(weeklyState.selected.length > 0 ? 'review' : 'select');
  };

  const handleToggleWeeklySelect = (id: string) => {
    if (id === '__clear__') {
      setWeeklyState(prev => ({ ...prev, selected: [], done: [] }));
      return;
    }
    setWeeklyState(prev => ({
      ...prev,
      selected: prev.selected.includes(id)
        ? prev.selected.filter(x => x !== id)
        : [...prev.selected, id],
    }));
  };

  const handleAddLog = (wordId: string, entry: UsageLogEntry) => {
    setWeeklyState(prev => {
      const prevLogs = prev.wordLogs ?? {};
      return {
        ...prev,
        wordLogs: {
          ...prevLogs,
          [wordId]: [...(prevLogs[wordId] || []), entry],
        },
      };
    });
  };

  // Queue selection handlers
  const handleToggleQueueSelect = (id: string) => {
    if (id === '__clear__') { setQueueSelected([]); return; }
    setQueueSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleQueueSelectConfirm = async (ids: string[]) => {
    const now = new Date().toISOString();
    await Promise.all(ids.map(id => setReviewDate(id, now)));
    setQueueSelected([]);
    setShowQueueSelect(false);
  };

  const handleReviewButtonClick = () => {
    if (queuedWords.length === 0) {
      setShowQueueSelect(true);
    } else {
      setShowReview(true);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <div className="text-zinc-500">Loading...</div>
      </div>
    );
  }

  if (showAuth && !user) {
    return <Auth onCancel={() => setShowAuth(false)} />;
  }

  const isReadOnly = !user;

  const learnWords = words.filter(
    (w) => (w.category === 'LEARNING' || w.category === 'JUST_ADDED') && w.word_type !== 'sentence'
  );
  const reviseItems = words.filter(
    (w) => w.word_type === 'sentence' || w.familiarity === 'NEED_TO_USE'
  );
  const totalReviewable = learnWords.length + reviseItems.length;

  const now = new Date();
  const dueWords = words.filter(w =>
    !w.is_archived && w.next_review_at && new Date(w.next_review_at) <= now
  );
  const queuedWords = words.filter(w =>
    !w.is_archived && w.next_review_at != null
  );
  const weeklySelectedWords = words.filter(w => weeklyState.selected.includes(w.id));
  const hasWeeklyWords = weeklyState.selected.length > 0;
  // Guard: wordLogs may be absent on old localStorage state or HMR state preservation
  const safeWordLogs = weeklyState.wordLogs ?? {};

  return (
    <div className="min-h-screen bg-zinc-900 flex flex-col">
      {/* Top header */}
      <header className="border-b border-zinc-800/70 sticky top-0 bg-zinc-900/95 backdrop-blur z-40">
        <div className="px-6 py-3.5">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-medium tracking-tight text-zinc-100">
              {activeModule === 'grammar'
                ? grammarView === 'sessions' ? 'Sessions' : 'Grammar Coach'
                : 'Vocabulary'}
            </h1>

            <div className="flex items-center gap-3">
              {activeModule === 'vocabulary' && !isReadOnly && words.length > 0 && (
                <button
                  onClick={handleReviewButtonClick}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    dueWords.length > 0
                      ? 'bg-violet-900/40 hover:bg-violet-900/60 text-violet-300 border border-violet-800/50'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
                  }`}
                >
                  <BookOpenCheck size={18} />
                  Review
                  {dueWords.length > 0 && (
                    <span className="w-5 h-5 rounded-full bg-violet-500 text-zinc-900 text-[10px] font-bold flex items-center justify-center">
                      {dueWords.length}
                    </span>
                  )}
                </button>
              )}

              {activeModule === 'vocabulary' && !isReadOnly && (
                <button
                  onClick={() => setShowQuickAdd(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-lg transition-colors"
                >
                  <Plus size={18} />
                  Add Word
                </button>
              )}

              <div className="relative" ref={settingsRef}>
                <button
                  onClick={() => setShowSettings(s => !s)}
                  className="p-2 text-zinc-400 hover:text-zinc-100 transition-colors"
                  title="Settings"
                >
                  <Settings size={20} />
                </button>
                {showSettings && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl p-4 z-50">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">English variant</p>
                    <div className="flex flex-col gap-1.5">
                      {(['en-AU', 'en-US'] as const).map(loc => (
                        <button
                          key={loc}
                          onClick={() => { setLocale(loc); setShowSettings(false); }}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                            locale === loc
                              ? 'bg-zinc-700 text-zinc-100'
                              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'
                          }`}
                        >
                          <span>{loc === 'en-AU' ? 'Australian / British' : 'American'}</span>
                          {locale === loc && <span className="text-zinc-400 text-xs">✓</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {user ? (
                <button onClick={signOut} className="p-2 text-zinc-400 hover:text-zinc-100 transition-colors">
                  <LogOut size={20} />
                </button>
              ) : (
                <button
                  onClick={() => setShowAuth(true)}
                  className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors px-2 py-1"
                >
                  Log in
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Body: sidebar + content */}
      <div className="flex flex-1">
        {/* Left sidebar nav */}
        <nav className="w-52 shrink-0 border-r border-zinc-800/70 px-3 py-8 flex flex-col gap-0.5">
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-medium px-3 mb-2">Modules</p>

          {/* Vocabulary */}
          <button
            onClick={() => setActiveModule('vocabulary')}
            className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 text-left border-l-2 ${
              activeModule === 'vocabulary'
                ? 'bg-zinc-800/80 text-zinc-100 border-l-violet-500'
                : 'border-l-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'
            }`}
          >
            <BookOpen
              size={15}
              className={activeModule === 'vocabulary' ? 'text-violet-400' : 'text-zinc-600'}
            />
            Vocabulary
          </button>

          {/* Grammar — with Sessions sub-item */}
          <div className="flex flex-col">
            <button
              onClick={() => { setActiveModule('grammar'); setGrammarView('coach'); }}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 text-left border-l-2 ${
                activeModule === 'grammar' && grammarView === 'coach'
                  ? 'bg-zinc-800/80 text-zinc-100 border-l-amber-500'
                  : 'border-l-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'
              }`}
            >
              <Mic
                size={15}
                className={activeModule === 'grammar' ? 'text-amber-400' : 'text-zinc-600'}
              />
              Grammar
            </button>

            {/* Sessions sub-item */}
            <div className="ml-[22px] pl-3 border-l border-zinc-700/40 mt-0.5 mb-0.5">
              <button
                onClick={() => { setActiveModule('grammar'); setGrammarView('sessions'); }}
                className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-[13px] transition-all duration-150 text-left ${
                  activeModule === 'grammar' && grammarView === 'sessions'
                    ? 'text-amber-300/90 bg-zinc-800/60'
                    : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/30'
                }`}
              >
                <Library size={12} className={activeModule === 'grammar' && grammarView === 'sessions' ? 'text-amber-400/70' : 'text-zinc-700'} />
                Sessions
              </button>
            </div>
          </div>
        </nav>

        {/* Main content */}
        <main className="flex-1 px-8 py-10 overflow-y-auto">
          {activeModule === 'grammar' ? (
            <GrammarModule
              userId={user?.id ?? null}
              locale={locale}
              view={grammarView}
              onSessionEnded={() => setGrammarView('sessions')}
            />
          ) : wordsLoading ? (
            <div className="text-center text-zinc-500">Loading...</div>
          ) : words.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-zinc-500 mb-4">No words yet</p>
              {!isReadOnly && (
                <button onClick={() => setShowQuickAdd(true)} className="text-zinc-400 hover:text-zinc-100 underline">
                  Add your first word
                </button>
              )}
            </div>
          ) : (
            <WordBank
              words={words}
              updateWord={updateWord}
              deleteWord={deleteWord}
              archiveWord={archiveWord}
              unarchiveWord={unarchiveWord}
              bulkArchiveWords={bulkArchiveWords}
              practiceWord={practiceWord}
              setReviewDate={setReviewDate}
              isReadOnly={isReadOnly}
              weeklyMode={weeklyView === 'select'}
              weeklySelected={weeklyState.selected}
              onToggleWeeklySelect={handleToggleWeeklySelect}
              onWeeklyClose={() => {
                setWeeklyView(weeklyState.selected.length > 0 ? 'review' : 'off');
              }}
              queueSelectMode={showQueueSelect}
              queueSelected={queueSelected}
              onToggleQueueSelect={handleToggleQueueSelect}
              onQueueSelectConfirm={handleQueueSelectConfirm}
              onQueueSelectClose={() => { setShowQueueSelect(false); setQueueSelected([]); }}
            />
          )}
        </main>
      </div>

      {/* WeeklyReview hidden — not in use (added 2026-04-24, ask to delete after ~1 week)
      {weeklyView === 'review' && (
        <WeeklyReview
          selectedWords={weeklySelectedWords}
          wordLogs={safeWordLogs}
          onAddLog={handleAddLog}
          onChangeWords={() => setWeeklyView('select')}
          onClose={() => setWeeklyView('off')}
        />
      )}
      */}

      {showQuickAdd && <QuickAdd onClose={() => setShowQuickAdd(false)} addWord={addWord} checkDuplicate={checkDuplicate} locale={locale} />}

      {/* Practice mode selector + learn/revise modes hidden — not in use (added 2026-04-24, ask to delete after ~1 week)
      {showModeSelector && (
        <ReviewModeSelector
          learnCount={learnWords.length}
          reviseCount={reviseItems.length}
          onSelectLearn={() => { setShowModeSelector(false); setShowLearn(true); }}
          onSelectRevise={() => { setShowModeSelector(false); setShowRevise(true); }}
          onClose={() => setShowModeSelector(false)}
        />
      )}
      {showLearn && <ReviewMode words={words} mode="learn" onClose={() => setShowLearn(false)} practiceWord={practiceWord} />}
      {showRevise && <ReviewMode words={words} mode="revise" onClose={() => setShowRevise(false)} practiceWord={practiceWord} />}
      */}
      {showReview && <ReviewMode words={words} mode="review" onClose={() => setShowReview(false)} practiceWord={practiceWord} />}
    </div>
  );
}

export default App;
