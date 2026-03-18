import { useState, useRef, useEffect, useCallback } from 'react';
import { VocabularyWord } from '../lib/supabase';
import { Trash2, BookOpen, RotateCcw, BookMarked, Heart, CheckCircle2, Circle, Zap, X } from 'lucide-react';

interface WeeklyChallenge {
  wordIds: string[];
  completedIds: string[];
  startedAt: string;
}
import WordDetail from './WordDetail';
import Confetti from './Confetti';

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

type NavSection = 'NEED_TO_LEARN' | 'NEED_TO_USE' | 'KNOW_WELL';

interface WordBankProps {
  words: VocabularyWord[];
  updateWord: (id: string, updates: Partial<VocabularyWord>) => Promise<void>;
  deleteWord: (id: string) => Promise<void>;
  practiceWord: (id: string, userSentence: string) => Promise<void>;
  isReadOnly?: boolean;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  wordId: string | null;
}

const NAV_SECTIONS: { key: NavSection; label: string; icon: 'book' | 'rotate' | 'check' }[] = [
  { key: 'NEED_TO_LEARN', label: 'Need to Learn', icon: 'book' },
  { key: 'NEED_TO_USE',   label: 'Use More Often', icon: 'rotate' },
  { key: 'KNOW_WELL',     label: 'Know Well', icon: 'check' },
];

function getWordUpdatesForSection(section: NavSection): Partial<VocabularyWord> {
  if (section === 'NEED_TO_LEARN') return { category: 'LEARNING', familiarity: 'NEED_TO_LEARN' };
  if (section === 'NEED_TO_USE')   return { category: 'LEARNING', familiarity: 'NEED_TO_USE' };
  return { category: 'KNOW_WELL' };
}

export default function WordBank({ words, updateWord, deleteWord, practiceWord, isReadOnly = false }: WordBankProps) {
  const [activeSection, setActiveSection] = useState<'words' | 'sentences'>('words');
  const [activeNavSection, setActiveNavSection] = useState<NavSection>('NEED_TO_LEARN');
  const [selectedWord, setSelectedWord] = useState<VocabularyWord | null>(null);
  const [dragOverSection, setDragOverSection] = useState<NavSection | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    wordId: null,
  });
  const [celebratingWordId, setCelebratingWordId] = useState<string | null>(null);
  const [confettiOrigin, setConfettiOrigin] = useState<{ x: number; y: number } | null>(null);
  const [favoriteSources, setFavoriteSources] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('favoriteSources');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const contextMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedWord) {
      const updatedWord = words.find(w => w.id === selectedWord.id);
      if (updatedWord) {
        setSelectedWord(updatedWord);
      }
    }
  }, [words, selectedWord?.id]);

  const wordsAndPhrases = words.filter((w) => w.word_type !== 'sentence');
  const sentences = words.filter((w) => w.word_type === 'sentence');

  const getWordsForSection = (section: NavSection) => {
    if (section === 'NEED_TO_LEARN') return wordsAndPhrases.filter(w => w.category === 'LEARNING' && w.familiarity === 'NEED_TO_LEARN');
    if (section === 'NEED_TO_USE')   return wordsAndPhrases.filter(w => w.category === 'LEARNING' && w.familiarity === 'NEED_TO_USE');
    return wordsAndPhrases.filter(w => w.category === 'KNOW_WELL');
  };

  const activeWords = getWordsForSection(activeNavSection);

  const handleDragStart = (e: React.DragEvent, wordId: string) => {
    e.dataTransfer.setData('wordId', wordId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnSection = async (e: React.DragEvent, section: NavSection) => {
    e.preventDefault();
    setDragOverSection(null);
    const wordId = e.dataTransfer.getData('wordId');
    if (wordId) {
      await updateWord(wordId, getWordUpdatesForSection(section));
    }
  };

  const handleContextMenu = (e: React.MouseEvent, wordId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      wordId,
    });
  };

  const handleDelete = async () => {
    if (contextMenu.wordId) {
      await deleteWord(contextMenu.wordId);
      setContextMenu({ visible: false, x: 0, y: 0, wordId: null });
    }
  };

  const [exitingWordId, setExitingWordId] = useState<string | null>(null);

  // Weekly challenge state
  const [weeklyChallenge, setWeeklyChallenge] = useState<WeeklyChallenge | null>(() => {
    const saved = localStorage.getItem('weeklyChallenge');
    return saved ? JSON.parse(saved) : null;
  });
  const [showChallengePicker, setShowChallengePicker] = useState(false);
  const [pickerSelection, setPickerSelection] = useState<string[]>([]);

  const saveChallenge = (challenge: WeeklyChallenge | null) => {
    if (challenge) localStorage.setItem('weeklyChallenge', JSON.stringify(challenge));
    else localStorage.removeItem('weeklyChallenge');
    setWeeklyChallenge(challenge);
  };

  const toggleChallengeWord = (id: string) => {
    if (!weeklyChallenge) return;
    const completed = weeklyChallenge.completedIds.includes(id)
      ? weeklyChallenge.completedIds.filter(c => c !== id)
      : [...weeklyChallenge.completedIds, id];
    saveChallenge({ ...weeklyChallenge, completedIds: completed });
  };

  const startChallenge = () => {
    saveChallenge({ wordIds: pickerSelection, completedIds: [], startedAt: new Date().toISOString() });
    setShowChallengePicker(false);
    setPickerSelection([]);
  };

  const useMoreOftenWords = wordsAndPhrases.filter(w => w.category === 'LEARNING' && w.familiarity === 'NEED_TO_USE');
  const challengeWords = weeklyChallenge
    ? useMoreOftenWords.filter(w => weeklyChallenge.wordIds.includes(w.id))
    : [];
  const allDone = weeklyChallenge && challengeWords.length > 0 &&
    weeklyChallenge.completedIds.length >= weeklyChallenge.wordIds.filter(id => useMoreOftenWords.some(w => w.id === id)).length;

  const handleConfettiComplete = useCallback(() => {
    setConfettiOrigin(null);
  }, []);

  const handleMoveToSection = async (e: React.MouseEvent, wordId: string, targetSection: NavSection) => {
    e.stopPropagation();

    if (targetSection === 'NEED_TO_USE') {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setConfettiOrigin({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    }

    setCelebratingWordId(wordId);
    setExitingWordId(wordId);

    setTimeout(async () => {
      await updateWord(wordId, getWordUpdatesForSection(targetSection));
      setCelebratingWordId(null);
      setExitingWordId(null);
    }, 600);
  };

  const toggleFavoriteSource = (e: React.MouseEvent, sourceTag: string) => {
    e.stopPropagation();
    setFavoriteSources(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sourceTag)) {
        newSet.delete(sourceTag);
      } else {
        newSet.add(sourceTag);
      }
      localStorage.setItem('favoriteSources', JSON.stringify([...newSet]));
      return newSet;
    });
  };

  const isFavoriteSource = (sourceTag: string) => favoriteSources.has(sourceTag);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu({ visible: false, x: 0, y: 0, wordId: null });
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu({ visible: false, x: 0, y: 0, wordId: null });
      }
    };

    if (contextMenu.visible) {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [contextMenu.visible]);

  const renderWordCard = (word: VocabularyWord, section: NavSection = 'NEED_TO_LEARN') => {
    const isCelebrating = celebratingWordId === word.id;
    const isExiting = exitingWordId === word.id;
    const tagColor = word.source_tag ? getTagColor(word.source_tag) : null;
    const isNeedToUse = section === 'NEED_TO_USE';

    return (
      <div
        key={word.id}
        draggable={!isReadOnly}
        onDragStart={!isReadOnly ? (e) => handleDragStart(e, word.id) : undefined}
        onClick={() => setSelectedWord(word)}
        onContextMenu={!isReadOnly ? (e) => handleContextMenu(e, word.id) : undefined}
        className={`group relative bg-zinc-800/50 border rounded-lg p-4 transition-all ${
          isReadOnly ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
        } ${
          isNeedToUse ? 'border-teal-900/30 hover:border-teal-800/50' : 'border-zinc-700/50 hover:border-zinc-600'
        } ${isCelebrating ? 'animate-celebrate' : ''} ${isExiting ? 'animate-card-exit' : 'animate-card-enter'}`}
      >
        {!isReadOnly && (
          <button
            onClick={(e) => handleMoveToSection(e, word.id, isNeedToUse ? 'NEED_TO_LEARN' : 'NEED_TO_USE')}
            className={`absolute top-2 right-2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-all ${
              isNeedToUse
                ? 'text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10'
                : 'text-zinc-500 hover:text-teal-400 hover:bg-teal-500/10'
            }`}
            title={isNeedToUse ? 'Move back to Need to Learn' : 'Move to Use More Often'}
          >
            {isNeedToUse ? <RotateCcw size={14} /> : <BookOpen size={14} />}
          </button>
        )}
        <div className="flex-1 min-w-0 pr-6">
          <div className="text-zinc-100 text-sm">{word.word}</div>
          <div className="text-zinc-500 text-xs leading-relaxed mt-1 line-clamp-1">
            {word.definition}
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {word.word_type === 'phrase' && (
              <span className="text-[10px] text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">
                phrase
              </span>
            )}
            {word.source_tag && tagColor && (
              <button
                onClick={(e) => toggleFavoriteSource(e, word.source_tag!)}
                title={isFavoriteSource(word.source_tag) ? 'Unfavorite source' : 'Favorite this source'}
                className={`group/tag inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-all ${tagColor.bg} ${tagColor.text} border ${tagColor.border} ${
                  isFavoriteSource(word.source_tag) ? 'source-tag-favorite' : ''
                }`}
              >
                {isFavoriteSource(word.source_tag) ? (
                  <Heart size={9} className="fill-current animate-heartbeat" />
                ) : (
                  <BookMarked size={9} className="group-hover/tag:hidden" />
                )}
                {!isFavoriteSource(word.source_tag) && (
                  <Heart size={9} className="hidden group-hover/tag:block" />
                )}
                {word.source_tag}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="flex gap-8">
        <aside className="w-48 flex-shrink-0">
          <nav className="sticky top-24 space-y-6">
            <div className="flex gap-1 text-[11px] text-zinc-600 mb-4">
              <button
                onClick={() => setActiveSection('words')}
                className={`px-2 py-1 rounded transition-colors ${
                  activeSection === 'words' ? 'bg-zinc-800 text-zinc-400' : 'hover:text-zinc-500'
                }`}
              >
                words
              </button>
              <span className="py-1">/</span>
              <button
                onClick={() => setActiveSection('sentences')}
                className={`px-2 py-1 rounded transition-colors ${
                  activeSection === 'sentences' ? 'bg-zinc-800 text-zinc-400' : 'hover:text-zinc-500'
                }`}
              >
                sentences
              </button>
            </div>

            {activeSection === 'words' && (
              <div className="space-y-1">
                {NAV_SECTIONS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setActiveNavSection(key)}
                    onDragOver={(e) => { handleDragOver(e); setDragOverSection(key); }}
                    onDragLeave={() => setDragOverSection(null)}
                    onDrop={(e) => handleDropOnSection(e, key)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      activeNavSection === key
                        ? 'bg-zinc-800 text-zinc-100'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'
                    } ${dragOverSection === key ? 'ring-2 ring-teal-500/50 bg-zinc-800/60' : ''}`}
                  >
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* This Week panel */}
            {!isReadOnly && activeSection === 'words' && (
              <div className="pt-4 border-t border-zinc-800">
                {!weeklyChallenge ? (
                  <button
                    onClick={() => { setShowChallengePicker(true); setPickerSelection([]); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40 transition-all"
                  >
                    <Zap size={13} />
                    This week
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[11px] text-zinc-500 font-medium flex items-center gap-1.5">
                        <Zap size={11} />
                        This week
                      </span>
                      <button
                        onClick={() => saveChallenge(null)}
                        className="text-zinc-700 hover:text-zinc-500 transition-colors"
                        title="Clear challenge"
                      >
                        <X size={11} />
                      </button>
                    </div>
                    {allDone && (
                      <div className="text-[11px] text-teal-400 px-1 pb-1">All done! 🎉</div>
                    )}
                    {challengeWords.length === 0 ? (
                      <p className="text-[11px] text-zinc-600 px-1 italic">Words removed from Use More Often</p>
                    ) : (
                      challengeWords.map(w => {
                        const done = weeklyChallenge.completedIds.includes(w.id);
                        return (
                          <button
                            key={w.id}
                            onClick={() => toggleChallengeWord(w.id)}
                            className={`w-full flex items-start gap-2 px-2 py-1.5 rounded-lg text-left transition-all hover:bg-zinc-800/60 ${done ? 'opacity-50' : ''}`}
                          >
                            {done
                              ? <CheckCircle2 size={13} className="text-teal-400 mt-0.5 flex-shrink-0" />
                              : <Circle size={13} className="text-zinc-600 mt-0.5 flex-shrink-0" />
                            }
                            <span className={`text-xs leading-snug ${done ? 'line-through text-zinc-600' : 'text-zinc-300'}`}>
                              {w.word}
                            </span>
                          </button>
                        );
                      })
                    )}
                    <button
                      onClick={() => { setShowChallengePicker(true); setPickerSelection(weeklyChallenge.wordIds); }}
                      className="w-full text-left px-2 py-1 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
                    >
                      change words
                    </button>
                  </div>
                )}
              </div>
            )}
          </nav>
        </aside>

        <main className="flex-1 min-w-0">
          {activeSection === 'words' ? (
            <>
              {activeWords.length === 0 ? (
                <div className="text-zinc-600 text-sm italic py-8">No words here yet</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeWords.map((word) => renderWordCard(word, activeNavSection))}
                </div>
              )}
            </>
          ) : (
            <>
              {sentences.length === 0 ? (
                <div className="text-zinc-600 text-sm italic py-8">No sentences yet</div>
              ) : (
                <div className="space-y-3">
                  {sentences.map((sentence) => {
                    const tagColor = sentence.source_tag ? getTagColor(sentence.source_tag) : null;
                    return (
                      <div
                        key={sentence.id}
                        onClick={() => setSelectedWord(sentence)}
                        onContextMenu={(e) => handleContextMenu(e, sentence.id)}
                        className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4 hover:border-zinc-600 transition-colors cursor-pointer"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-zinc-200 text-sm leading-relaxed">{sentence.word}</div>
                          {sentence.definition && (
                            <div className="text-zinc-500 text-xs leading-relaxed mt-2">
                              {sentence.definition}
                            </div>
                          )}
                          {sentence.source_tag && tagColor && (
                            <button
                              onClick={(e) => toggleFavoriteSource(e, sentence.source_tag!)}
                              title={isFavoriteSource(sentence.source_tag) ? 'Unfavorite source' : 'Favorite this source'}
                              className={`group/tag inline-flex items-center gap-1 mt-3 px-2 py-1 rounded text-[10px] transition-all ${tagColor.bg} ${tagColor.text} border ${tagColor.border} ${
                                isFavoriteSource(sentence.source_tag) ? 'source-tag-favorite' : ''
                              }`}
                            >
                              {isFavoriteSource(sentence.source_tag) ? (
                                <Heart size={10} className="fill-current animate-heartbeat" />
                              ) : (
                                <BookMarked size={10} className="group-hover/tag:hidden" />
                              )}
                              {!isFavoriteSource(sentence.source_tag) && (
                                <Heart size={10} className="hidden group-hover/tag:block" />
                              )}
                              {sentence.source_tag}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {!isReadOnly && contextMenu.visible && (
        <div
          ref={contextMenuRef}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[140px]"
        >
          <button
            onClick={handleDelete}
            className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-zinc-800 flex items-center gap-2 transition-colors"
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      )}

      {/* Weekly challenge picker modal */}
      {showChallengePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-zinc-100 font-medium">This week</h2>
              <button onClick={() => setShowChallengePicker(false)} className="text-zinc-600 hover:text-zinc-400">
                <X size={16} />
              </button>
            </div>
            <p className="text-zinc-500 text-xs mb-5">Pick up to 3 words to use in speech this week.</p>

            {useMoreOftenWords.length === 0 ? (
              <p className="text-zinc-600 text-sm italic py-4">No words in Use More Often yet.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {useMoreOftenWords.map(w => {
                  const selected = pickerSelection.includes(w.id);
                  const disabled = !selected && pickerSelection.length >= 3;
                  return (
                    <button
                      key={w.id}
                      disabled={disabled}
                      onClick={() => setPickerSelection(prev =>
                        prev.includes(w.id) ? prev.filter(id => id !== w.id) : [...prev, w.id]
                      )}
                      className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-all border ${
                        selected
                          ? 'border-teal-500/50 bg-teal-500/10'
                          : disabled
                          ? 'border-zinc-800 opacity-40 cursor-not-allowed'
                          : 'border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/40'
                      }`}
                    >
                      {selected
                        ? <CheckCircle2 size={14} className="text-teal-400 mt-0.5 flex-shrink-0" />
                        : <Circle size={14} className="text-zinc-600 mt-0.5 flex-shrink-0" />
                      }
                      <div className="min-w-0">
                        <div className="text-sm text-zinc-200">{w.word}</div>
                        {w.definition && (
                          <div className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{w.definition}</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between mt-5">
              <span className="text-xs text-zinc-600">{pickerSelection.length} / 3 selected</span>
              <button
                disabled={pickerSelection.length === 0}
                onClick={startChallenge}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
              >
                Start
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedWord && (
        <WordDetail
          word={selectedWord}
          onClose={() => setSelectedWord(null)}
          updateWord={updateWord}
          practiceWord={practiceWord}
          isReadOnly={isReadOnly}
        />
      )}

      <Confetti
        active={confettiOrigin !== null}
        originX={confettiOrigin?.x}
        originY={confettiOrigin?.y}
        onComplete={handleConfettiComplete}
      />
    </>
  );
}
