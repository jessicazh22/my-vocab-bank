import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { VocabularyWord } from '../lib/supabase';
import { getTagColor } from '../lib/utils';
import { Trash2, BookOpen, RotateCcw, BookMarked, Heart, X, Check, Archive, CalendarPlus, CalendarCheck } from 'lucide-react';
import WordDetail from './WordDetail';
import Confetti from './Confetti';
import { Rating, Usefulness, USEFULNESS_LABELS, computeDays } from '../lib/srs';

type NavSection = 'NEED_TO_LEARN' | 'NEED_TO_USE' | 'KNOW_WELL';

interface WordBankProps {
  words: VocabularyWord[];
  updateWord: (id: string, updates: Partial<VocabularyWord>) => Promise<void>;
  deleteWord: (id: string) => Promise<void>;
  archiveWord: (id: string) => Promise<void>;
  unarchiveWord: (id: string) => Promise<void>;
  bulkArchiveWords: (ids: string[]) => Promise<void>;
  practiceWord: (id: string, userSentence: string, rating?: 'again' | 'hard' | 'good' | 'easy', usefulness?: 1 | 2 | 3 | 4) => Promise<void>;
  setReviewDate?: (id: string, next_review_at: string | null) => Promise<void>;
  isReadOnly?: boolean;
  weeklyMode?: boolean;
  weeklySelected?: string[];
  onToggleWeeklySelect?: (id: string) => void;
  onWeeklyClose?: () => void;
  // Queue selection mode
  queueSelectMode?: boolean;
  queueSelected?: string[];
  onToggleQueueSelect?: (id: string) => void;
  onQueueSelectConfirm?: (ids: string[]) => void;
  onQueueSelectClose?: () => void;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  wordId: string | null;
}

const NAV_SECTIONS: { key: NavSection; label: string; Icon: React.ElementType; activeText: string; cardGlow: string }[] = [
  { key: 'NEED_TO_LEARN', label: 'Need to Learn', Icon: BookOpen,  activeText: 'text-amber-300',   cardGlow: 'border-zinc-700/50 hover:border-zinc-500/50 hover:shadow-[0_0_16px_rgba(255,255,255,0.04)]' },
  { key: 'NEED_TO_USE',   label: 'Use More Often', Icon: RotateCcw, activeText: 'text-teal-300',    cardGlow: 'border-zinc-700/50 hover:border-zinc-500/50 hover:shadow-[0_0_16px_rgba(255,255,255,0.04)]' },
  { key: 'KNOW_WELL',     label: 'Know Well',      Icon: Check,     activeText: 'text-emerald-300', cardGlow: 'border-zinc-700/50 hover:border-zinc-500/50 hover:shadow-[0_0_16px_rgba(255,255,255,0.04)]' },
];

const QUEUE_RATING_COLORS: Record<string, string> = {
  again: 'bg-rose-900/40 hover:bg-rose-900/70 text-rose-300 border border-rose-800/50',
  hard:  'bg-orange-900/40 hover:bg-orange-900/70 text-orange-300 border border-orange-800/50',
  good:  'bg-zinc-700 hover:bg-zinc-600 text-zinc-200 border border-zinc-600',
  easy:  'bg-emerald-900/40 hover:bg-emerald-900/70 text-emerald-300 border border-emerald-800/50',
};

function getWordUpdatesForSection(section: NavSection): Partial<VocabularyWord> {
  if (section === 'NEED_TO_LEARN') return { category: 'LEARNING', familiarity: 'NEED_TO_LEARN' };
  if (section === 'NEED_TO_USE')   return { category: 'LEARNING', familiarity: 'NEED_TO_USE' };
  return { category: 'KNOW_WELL' };
}

export default function WordBank({ words, updateWord, deleteWord, archiveWord, unarchiveWord, bulkArchiveWords, practiceWord, setReviewDate, isReadOnly = false, weeklyMode = false, weeklySelected = [], onToggleWeeklySelect, onWeeklyClose, queueSelectMode = false, queueSelected = [], onToggleQueueSelect, onQueueSelectConfirm, onQueueSelectClose }: WordBankProps) {
  const toggleWeeklySelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleWeeklySelect?.(id);
  };

  const toggleQueueSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleQueueSelect?.(id);
  };

  // Also allow clearing via __clear__ sentinel
  const handleQueueToggle = (id: string) => {
    onToggleQueueSelect?.(id);
  };

  // When weeklyMode activates, jump to Use More Often section
  useEffect(() => {
    if (weeklyMode) setActiveNavSection('NEED_TO_USE');
  }, [weeklyMode]);

  // When queueSelectMode activates, jump to Need to Learn section
  useEffect(() => {
    if (queueSelectMode) setActiveNavSection('NEED_TO_LEARN');
  }, [queueSelectMode]);

  const [activeSection, setActiveSection] = useState<'words' | 'sentences' | 'archive'>('words');
  const [activeNavSection, setActiveNavSection] = useState<NavSection>('NEED_TO_LEARN');
  const [selectedWord, setSelectedWord] = useState<VocabularyWord | null>(null);
  const [bulkArchiveMode, setBulkArchiveMode] = useState(false);
  const [bulkArchiveSelected, setBulkArchiveSelected] = useState<Set<string>>(new Set());
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
      if (updatedWord) setSelectedWord(updatedWord);
    }
  }, [words, selectedWord?.id]);

  // Words and phrases combined
  const wordsAndPhrases = words.filter((w) => (w.word_type === 'word' || w.word_type === 'phrase') && !w.is_archived);
  const archived = words.filter((w) => w.is_archived);
  const sentences = words.filter((w) => w.word_type === 'sentence' && !w.is_archived);

  const getWordsForSection = (section: NavSection) => {
    if (section === 'NEED_TO_LEARN') return wordsAndPhrases.filter(w => w.category === 'LEARNING' && w.familiarity === 'NEED_TO_LEARN');
    if (section === 'NEED_TO_USE')   return wordsAndPhrases.filter(w => w.category === 'LEARNING' && w.familiarity === 'NEED_TO_USE');
    return wordsAndPhrases.filter(w => w.category === 'KNOW_WELL');
  };

  const activeWords = getWordsForSection(activeNavSection);

  // Word of the day — deterministic daily pick from Need to Learn
  const wordOfTheDay = useMemo(() => {
    if (activeNavSection !== 'NEED_TO_LEARN') return null;
    const words = getWordsForSection('NEED_TO_LEARN');
    if (words.length === 0) return null;
    const today = new Date().toDateString();
    let hash = 0;
    for (let i = 0; i < today.length; i++) hash = today.charCodeAt(i) + ((hash << 5) - hash);
    return words[Math.abs(hash) % words.length];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNavSection, wordsAndPhrases]);

  const [dragOverSection, setDragOverSection] = useState<NavSection | null>(null);
  const [dragOverArchive, setDragOverArchive] = useState(false);

  const handleDragStart = (e: React.DragEvent, wordId: string) => {
    e.dataTransfer.setData('wordId', wordId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleContextMenu = (e: React.MouseEvent, wordId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, wordId });
  };

  const handleDelete = async () => {
    if (contextMenu.wordId) {
      await deleteWord(contextMenu.wordId);
      setContextMenu({ visible: false, x: 0, y: 0, wordId: null });
    }
  };

  const handleArchive = async () => {
    if (contextMenu.wordId) {
      await archiveWord(contextMenu.wordId);
      setContextMenu({ visible: false, x: 0, y: 0, wordId: null });
    }
  };

  const handleBulkArchive = async () => {
    await bulkArchiveWords([...bulkArchiveSelected]);
    setBulkArchiveSelected(new Set());
    setBulkArchiveMode(false);
  };

  const toggleBulkArchiveSelect = (id: string) => {
    setBulkArchiveSelected(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const [exitingWordId, setExitingWordId] = useState<string | null>(null);
  const [queueOpenId, setQueueOpenId] = useState<string | null>(null);
  const [queueUsefulness, setQueueUsefulness] = useState<Usefulness>(2);
  const [queueSaving, setQueueSaving] = useState(false);

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
      if (newSet.has(sourceTag)) newSet.delete(sourceTag);
      else newSet.add(sourceTag);
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
      if (e.key === 'Escape') setContextMenu({ visible: false, x: 0, y: 0, wordId: null });
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

  const handleQuickArchive = async (e: React.MouseEvent, wordId: string) => {
    e.stopPropagation();
    await archiveWord(wordId);
  };

  const handleQueueRate = async (wordId: string, rating: Rating, usefulness: Usefulness) => {
    setQueueSaving(true);
    try {
      await practiceWord(wordId, '', rating, usefulness);
    } finally {
      setQueueSaving(false);
      setQueueOpenId(null);
    }
  };

  const renderWordCard = (word: VocabularyWord, section: NavSection = 'NEED_TO_LEARN') => {
    const isCelebrating = celebratingWordId === word.id;
    const isExiting = exitingWordId === word.id;
    const tagColor = word.source_tag ? getTagColor(word.source_tag) : null;
    const isNeedToUse = section === 'NEED_TO_USE';
    const isWeeklySelected = weeklySelected.includes(word.id);
    const isBulkSelected = bulkArchiveSelected.has(word.id);
    const isQueueSelected = queueSelected.includes(word.id);
    const anySelectMode = weeklyMode || bulkArchiveMode || queueSelectMode;

    return (
      <div
        key={word.id}
        draggable={!isReadOnly && !anySelectMode}
        onDragStart={!isReadOnly && !anySelectMode ? (e) => handleDragStart(e, word.id) : undefined}
        onClick={
          queueSelectMode ? (e) => toggleQueueSelect(word.id, e) :
          weeklyMode ? (e) => toggleWeeklySelect(word.id, e) :
          bulkArchiveMode ? () => toggleBulkArchiveSelect(word.id) :
          () => setSelectedWord(word)
        }
        onContextMenu={!isReadOnly && !anySelectMode ? (e) => handleContextMenu(e, word.id) : undefined}
        className={`group relative bg-zinc-800/50 border rounded-lg p-4 transition-all duration-150 cursor-pointer ${
          queueSelectMode
            ? isQueueSelected
              ? 'border-violet-500/60 bg-violet-500/5 ring-1 ring-violet-500/30'
              : 'border-zinc-700/50 hover:border-violet-500/30'
            : weeklyMode
              ? isWeeklySelected
                ? 'border-amber-500/60 bg-amber-500/5 ring-1 ring-amber-500/30'
                : 'border-zinc-700/50 hover:border-amber-500/30'
              : bulkArchiveMode
                ? isBulkSelected
                  ? 'border-red-500/60 bg-red-500/5 ring-1 ring-red-500/30'
                  : 'border-zinc-700/50 hover:border-red-500/30'
                : (NAV_SECTIONS.find(s => s.key === section)?.cardGlow ?? 'border-zinc-700/50 hover:border-zinc-600')
        } ${!isReadOnly && !anySelectMode ? 'cursor-grab active:cursor-grabbing' : ''} ${isCelebrating ? 'animate-celebrate' : ''} ${isExiting ? 'animate-card-exit' : 'animate-card-enter'}`}
      >
        {queueSelectMode && (
          <div className={`absolute top-3 right-3 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
            isQueueSelected ? 'bg-violet-500 border-violet-500' : 'border-zinc-600'
          }`}>
            {isQueueSelected && <Check size={11} className="text-zinc-900" />}
          </div>
        )}

        {weeklyMode && (
          <div className={`absolute top-3 right-3 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
            isWeeklySelected ? 'bg-amber-500 border-amber-500' : 'border-zinc-600'
          }`}>
            {isWeeklySelected && <Check size={11} className="text-zinc-900" />}
          </div>
        )}

        {bulkArchiveMode && (
          <div className={`absolute top-3 right-3 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
            isBulkSelected ? 'bg-red-500 border-red-500' : 'border-zinc-600'
          }`}>
            {isBulkSelected && <Check size={11} className="text-zinc-900" />}
          </div>
        )}

        {!isReadOnly && !anySelectMode && (
          <div className="absolute top-2 right-2 flex items-center gap-1">
            <div className="opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1">
              <button
                onClick={(e) => handleQuickArchive(e, word.id)}
                className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                title="Archive"
              >
                <Archive size={14} />
              </button>
              <button
                onClick={(e) => handleMoveToSection(e, word.id, isNeedToUse ? 'NEED_TO_LEARN' : 'NEED_TO_USE')}
                className={`p-1.5 rounded-md ${
                  isNeedToUse
                    ? 'text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10'
                    : 'text-zinc-500 hover:text-teal-400 hover:bg-teal-500/10'
                }`}
                title={isNeedToUse ? 'Move back to Need to Learn' : 'Move to Use More Often'}
              >
                {isNeedToUse ? <RotateCcw size={14} /> : <BookOpen size={14} />}
              </button>
            </div>
            {word.word_type === 'word' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (queueOpenId === word.id) {
                    setQueueOpenId(null);
                  } else {
                    setQueueOpenId(word.id);
                    setQueueUsefulness((word.usefulness ?? 2) as Usefulness);
                  }
                }}
                className={`p-1.5 rounded-md transition-all ${
                  word.next_review_at
                    ? 'text-violet-400 hover:text-violet-300 hover:bg-violet-500/10'
                    : 'opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-violet-400 hover:bg-violet-500/10'
                }`}
                title={word.next_review_at ? 'Queued for review — click to re-rate' : 'Add to review queue'}
              >
                {word.next_review_at ? <CalendarCheck size={14} /> : <CalendarPlus size={14} />}
              </button>
            )}
          </div>
        )}

        <div className="flex-1 min-w-0 pr-16">
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

        {/* Inline queue panel */}
        {!anySelectMode && word.word_type === 'word' && queueOpenId === word.id && (
          <div
            className="mt-3 pt-3 border-t border-zinc-700/50 space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">How often would you use this?</p>
              <div className="grid grid-cols-2 gap-1">
                {([1, 2, 3, 4] as Usefulness[]).map(u => (
                  <button
                    key={u}
                    onClick={() => setQueueUsefulness(u)}
                    className={`py-1.5 px-2 rounded text-xs text-left transition-colors ${
                      queueUsefulness === u
                        ? 'bg-violet-900/40 text-violet-300 border border-violet-700/50'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-500 border border-transparent'
                    }`}
                  >
                    {USEFULNESS_LABELS[u]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">How well do you know it?</p>
              <div className="grid grid-cols-4 gap-1">
                {(['again', 'hard', 'good', 'easy'] as Rating[]).map(r => (
                  <button
                    key={r}
                    onClick={() => handleQueueRate(word.id, r, queueUsefulness)}
                    disabled={queueSaving}
                    className={`py-1.5 rounded text-[10px] font-medium transition-colors disabled:opacity-50 flex flex-col items-center gap-0.5 ${QUEUE_RATING_COLORS[r]}`}
                  >
                    <span className="capitalize">{r}</span>
                    <span className="opacity-60">~{computeDays(r, queueUsefulness)}d</span>
                  </button>
                ))}
              </div>
            </div>
            {word.next_review_at && setReviewDate && (
              <button
                onClick={async () => {
                  await setReviewDate(word.id, null);
                  setQueueOpenId(null);
                }}
                className="text-[10px] text-zinc-600 hover:text-red-400 w-full text-center py-0.5 transition-colors"
              >
                Remove from queue
              </button>
            )}
            <button
              onClick={() => setQueueOpenId(null)}
              className="text-[10px] text-zinc-600 hover:text-zinc-400 w-full text-center py-0.5 transition-colors"
            >
              cancel
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="flex gap-8 items-start">
        <aside className="w-48 flex-shrink-0">
          <nav className="sticky top-24 space-y-6">
            {/* Top-level section switcher */}
            <div className="flex items-center gap-1 text-[11px] text-zinc-600 mb-5">
              <button
                onClick={() => setActiveSection('words')}
                className={`px-2 py-1 rounded transition-colors ${
                  activeSection === 'words' ? 'bg-zinc-800 text-zinc-300' : 'hover:text-zinc-400'
                }`}
              >
                words
              </button>
              <span>/</span>
              <button
                onClick={() => setActiveSection('sentences')}
                className={`px-2 py-1 rounded transition-colors ${
                  activeSection === 'sentences' ? 'bg-zinc-800 text-zinc-300' : 'hover:text-zinc-400'
                }`}
              >
                sentences
              </button>
            </div>

            {/* Words sub-nav */}
            {activeSection === 'words' && (
              <div className="space-y-1">
                {NAV_SECTIONS.map(({ key, label, Icon, activeText }) => (
                  <button
                    key={key}
                    onClick={() => setActiveNavSection(key)}
                    onDragOver={(e) => { handleDragOver(e); setDragOverSection(key); }}
                    onDragLeave={() => setDragOverSection(null)}
                    onDrop={async (e) => {
                      e.preventDefault();
                      setDragOverSection(null);
                      const wordId = e.dataTransfer.getData('wordId');
                      if (wordId) {
                        await updateWord(wordId, getWordUpdatesForSection(key));
                      }
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                      activeNavSection === key
                        ? `bg-zinc-800 ${activeText}`
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'
                    } ${dragOverSection === key ? 'ring-2 ring-teal-500/50 bg-zinc-800/60' : ''}`}
                  >
                    <Icon size={14} className="shrink-0" />
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Archive link — always visible when not readonly; acts as a drag drop target */}
            {!isReadOnly ? (
              <button
                onClick={() => setActiveSection('archive')}
                onDragOver={(e) => { handleDragOver(e); setDragOverArchive(true); }}
                onDragLeave={() => setDragOverArchive(false)}
                onDrop={async (e) => {
                  e.preventDefault();
                  setDragOverArchive(false);
                  const wordId = e.dataTransfer.getData('wordId');
                  if (wordId) await archiveWord(wordId);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all mt-4 ${
                  activeSection === 'archive' ? 'text-zinc-400' : 'text-zinc-700 hover:text-zinc-500'
                } ${dragOverArchive ? 'ring-2 ring-red-500/30 bg-zinc-800/60 text-zinc-500' : ''}`}
              >
                archive{archived.length > 0 && ` (${archived.length})`}
              </button>
            ) : archived.length > 0 && (
              <button
                onClick={() => setActiveSection('archive')}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors mt-4 ${
                  activeSection === 'archive' ? 'text-zinc-400' : 'text-zinc-700 hover:text-zinc-500'
                }`}
              >
                archive ({archived.length})
              </button>
            )}
          </nav>
        </aside>

        <main className="flex-1 min-w-0">
          {activeSection !== 'archive' && !bulkArchiveMode && !weeklyMode && (
            <div className="flex justify-end mb-3">
              <button
                onClick={() => setBulkArchiveMode(true)}
                className="text-xs text-zinc-600 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-red-500/5 flex items-center gap-1.5"
              >
                <Archive size={12} />
                Bulk archive
              </button>
            </div>
          )}

          {activeSection === 'words' ? (
            <>
              {activeWords.length === 0 ? (
                <div className="text-zinc-600 text-sm italic py-8">No words here yet</div>
              ) : (
                <>
                  {/* Word of the day — featured card, Need to Learn only */}
                  {wordOfTheDay && !weeklyMode && !bulkArchiveMode && !queueSelectMode && (() => {
                    const tagColor = wordOfTheDay.source_tag ? getTagColor(wordOfTheDay.source_tag) : null;
                    return (
                      <div
                        onClick={() => setSelectedWord(wordOfTheDay)}
                        className="mb-4 cursor-pointer group relative bg-zinc-800/60 border border-zinc-700/50
                          hover:border-zinc-500/50 hover:shadow-[0_0_20px_rgba(255,255,255,0.05)]
                          transition-all duration-150 rounded-xl px-6 py-5"
                      >
                        <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-4">word of the day ✦</p>
                        <p className="text-2xl font-medium text-zinc-100 tracking-tight mb-2">{wordOfTheDay.word}</p>
                        {wordOfTheDay.definition && (
                          <p className="text-sm text-zinc-400 leading-relaxed line-clamp-2 mb-3">{wordOfTheDay.definition}</p>
                        )}
                        {wordOfTheDay.source_tag && tagColor && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] ${tagColor.bg} ${tagColor.text} border ${tagColor.border}`}>
                            <BookMarked size={9} />
                            {wordOfTheDay.source_tag}
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {/* Regular grid — featured word excluded */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {activeWords
                      .filter(w => !wordOfTheDay || w.id !== wordOfTheDay.id)
                      .map((word) => renderWordCard(word, activeNavSection))}
                  </div>
                </>
              )}
            </>
          ) : activeSection === 'archive' ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-zinc-500 text-xs">Hover a word to restore it to the bank.</p>
              </div>
              {archived.length === 0 ? (
                <div className="text-zinc-600 text-sm italic py-8">No archived items yet</div>
              ) : (
                <div className="space-y-3">
                  {archived.map((word) => {
                    const tagColor = word.source_tag ? getTagColor(word.source_tag) : null;
                    return (
                      <div
                        key={word.id}
                        onClick={() => setSelectedWord(word)}
                        className="group relative bg-zinc-800/30 border border-zinc-700/50 rounded-lg p-4 hover:border-zinc-600 transition-colors cursor-pointer opacity-75 hover:opacity-100"
                      >
                        <button
                          onClick={(e) => { e.stopPropagation(); unarchiveWord(word.id); }}
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-1 rounded text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 transition-all"
                          title="Restore to bank"
                        >
                          <RotateCcw size={11} />
                          Restore
                        </button>
                        <div className="flex-1 min-w-0 pr-16">
                          <div className="text-zinc-400 text-sm">{word.word}</div>
                          <div className="text-zinc-600 text-xs leading-relaxed mt-1 line-clamp-1">
                            {word.definition}
                          </div>
                          {word.source_tag && tagColor && (
                            <button
                              onClick={(e) => toggleFavoriteSource(e, word.source_tag!)}
                              className={`group/tag inline-flex items-center gap-1 mt-2 px-1.5 py-0.5 rounded text-[10px] transition-all ${tagColor.bg} ${tagColor.text} border ${tagColor.border}`}
                            >
                              <BookMarked size={9} />
                              {word.source_tag}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            /* Sentences section */
            <>
              {sentences.length === 0 ? (
                <div className="text-zinc-600 text-sm italic py-8">No sentences yet</div>
              ) : (
                <div className="space-y-3">
                  {sentences.map((sentence) => {
                    const tagColor = sentence.source_tag ? getTagColor(sentence.source_tag) : null;
                    const isBulkSelected = bulkArchiveSelected.has(sentence.id);
                    return (
                      <div
                        key={sentence.id}
                        onClick={bulkArchiveMode ? () => toggleBulkArchiveSelect(sentence.id) : () => setSelectedWord(sentence)}
                        onContextMenu={!bulkArchiveMode ? (e) => handleContextMenu(e, sentence.id) : undefined}
                        className={`group relative bg-zinc-800/50 border rounded-lg p-4 transition-colors cursor-pointer ${
                          bulkArchiveMode
                            ? isBulkSelected
                              ? 'border-red-500/60 bg-red-500/5 ring-1 ring-red-500/30'
                              : 'border-zinc-700/50 hover:border-red-500/30'
                            : 'border-zinc-700/50 hover:border-zinc-600'
                        }`}
                      >
                        {bulkArchiveMode && (
                          <div className={`absolute top-3 right-3 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                            isBulkSelected ? 'bg-red-500 border-red-500' : 'border-zinc-600'
                          }`}>
                            {isBulkSelected && <Check size={11} className="text-zinc-900" />}
                          </div>
                        )}

                        {!bulkArchiveMode && (
                          <button
                            onClick={(e) => handleQuickArchive(e, sentence.id)}
                            className="absolute top-2 right-2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                            title="Archive"
                          >
                            <Archive size={14} />
                          </button>
                        )}

                        <div className="flex-1 min-w-0 pr-8">
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
            onClick={handleArchive}
            className="w-full px-3 py-2 text-left text-sm text-orange-400 hover:bg-zinc-800 flex items-center gap-2 transition-colors"
          >
            <Archive size={14} />
            Archive
          </button>
          <button
            onClick={handleDelete}
            className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-zinc-800 flex items-center gap-2 transition-colors"
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      )}

      {selectedWord && (
        <WordDetail
          word={selectedWord}
          onClose={() => setSelectedWord(null)}
          updateWord={updateWord}
          practiceWord={practiceWord}
          setReviewDate={setReviewDate}
          isReadOnly={isReadOnly}
          onWordUpdate={() => {
            const updated = words.find(w => w.id === selectedWord.id);
            if (updated) setSelectedWord(updated);
          }}
        />
      )}

      <Confetti
        active={confettiOrigin !== null}
        originX={confettiOrigin?.x}
        originY={confettiOrigin?.y}
        onComplete={handleConfettiComplete}
      />

      {bulkArchiveMode && activeSection !== 'archive' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-zinc-800 border border-zinc-700 rounded-2xl px-5 py-4 shadow-2xl max-w-sm w-full mx-4">
          <p className="text-xs text-zinc-400 mb-3 leading-relaxed">
            Select items to archive. <span className="text-zinc-500">They&apos;ll move to the archive.</span>
          </p>
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-300">
              {bulkArchiveSelected.size === 0 ? 'None selected' : `${bulkArchiveSelected.size} item${bulkArchiveSelected.size === 1 ? '' : 's'} selected`}
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setBulkArchiveMode(false); setBulkArchiveSelected(new Set()); }}
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                Cancel
              </button>
              {bulkArchiveSelected.size > 0 && (
                <button
                  onClick={handleBulkArchive}
                  className="text-sm font-medium text-red-400 hover:text-red-300 transition-colors"
                >
                  Archive
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {weeklyMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-zinc-800 border border-zinc-700 rounded-2xl px-5 py-4 shadow-2xl max-w-sm w-full mx-4">
          <p className="text-xs text-zinc-400 mb-3 leading-relaxed">
            Choose your words for the week. <span className="text-zinc-500">The goal: slip them into real conversations.</span>
          </p>
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-300">
              {weeklySelected.length === 0 ? 'None selected yet' : `${weeklySelected.length} word${weeklySelected.length === 1 ? '' : 's'} selected`}
            </span>
            <div className="flex items-center gap-3">
              {weeklySelected.length > 0 && (
                <button onClick={() => onToggleWeeklySelect?.('__clear__')} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
                  Clear
                </button>
              )}
              <button onClick={onWeeklyClose} className="text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {queueSelectMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-zinc-800 border border-zinc-700 rounded-2xl px-5 py-4 shadow-2xl max-w-sm w-full mx-4">
          <p className="text-xs text-zinc-400 mb-3 leading-relaxed">
            Choose words to add to your review queue. <span className="text-zinc-500">They'll be due immediately.</span>
          </p>
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-300">
              {queueSelected.length === 0 ? 'None selected yet' : `${queueSelected.length} word${queueSelected.length === 1 ? '' : 's'} selected`}
            </span>
            <div className="flex items-center gap-3">
              {queueSelected.length > 0 && (
                <button onClick={() => onToggleQueueSelect?.('__clear__')} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
                  Clear
                </button>
              )}
              <button onClick={onQueueSelectClose} className="text-xs text-zinc-500 hover:text-zinc-400 transition-colors">
                Cancel
              </button>
              {queueSelected.length > 0 && (
                <button
                  onClick={() => onQueueSelectConfirm?.(queueSelected)}
                  className="text-sm font-medium text-violet-400 hover:text-violet-300 transition-colors"
                >
                  Add to queue
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
