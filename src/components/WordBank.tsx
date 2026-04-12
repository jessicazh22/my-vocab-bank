import { useState, useRef, useEffect, useCallback } from 'react';
import { VocabularyWord } from '../lib/supabase';
import { Trash2, BookOpen, RotateCcw, BookMarked, Heart, X, Check, Archive } from 'lucide-react';
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
  archiveWord: (id: string) => Promise<void>;
  practiceWord: (id: string, userSentence: string) => Promise<void>;
  isReadOnly?: boolean;
  weeklyMode?: boolean;
  weeklySelected?: string[];
  onToggleWeeklySelect?: (id: string) => void;
  onWeeklyClose?: () => void;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  wordId: string | null;
}

const NAV_SECTIONS: { key: NavSection; label: string }[] = [
  { key: 'NEED_TO_LEARN', label: 'Need to Learn' },
  { key: 'NEED_TO_USE',   label: 'Use More Often' },
  { key: 'KNOW_WELL',     label: 'Know Well' },
];

function getWordUpdatesForSection(section: NavSection): Partial<VocabularyWord> {
  if (section === 'NEED_TO_LEARN') return { category: 'LEARNING', familiarity: 'NEED_TO_LEARN' };
  if (section === 'NEED_TO_USE')   return { category: 'LEARNING', familiarity: 'NEED_TO_USE' };
  return { category: 'KNOW_WELL' };
}

export default function WordBank({ words, updateWord, deleteWord, archiveWord, practiceWord, isReadOnly = false, weeklyMode = false, weeklySelected = [], onToggleWeeklySelect, onWeeklyClose }: WordBankProps) {
  const toggleWeeklySelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleWeeklySelect?.(id);
  };

  // When weeklyMode activates, jump to Use More Often section
  useEffect(() => {
    if (weeklyMode) setActiveNavSection('NEED_TO_USE');
  }, [weeklyMode]);
  const [activeSection, setActiveSection] = useState<'words' | 'phrases' | 'sentences' | 'archive'>('words');
  const [activeNavSection, setActiveNavSection] = useState<NavSection>('NEED_TO_LEARN');
  const [selectedWord, setSelectedWord] = useState<VocabularyWord | null>(null);
  const [dragOverSection, setDragOverSection] = useState<NavSection | null>(null);
  const [dragOverPhrases, setDragOverPhrases] = useState(false);
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
      if (updatedWord) {
        setSelectedWord(updatedWord);
      }
    }
  }, [words, selectedWord?.id]);

  const wordsAndPhrases = words.filter((w) => w.word_type === 'word' && !w.is_archived);
  const phrases = words.filter((w) => w.word_type === 'phrase' && !w.is_archived);
  const archived = words.filter((w) => w.is_archived);
  const sentences = words.filter((w) => w.word_type === 'sentence' && !w.is_archived);

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

  const handleDropOnPhrases = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverPhrases(false);
    const wordId = e.dataTransfer.getData('wordId');
    if (wordId) {
      await updateWord(wordId, { word_type: 'phrase' });
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

  const handleArchive = async () => {
    if (contextMenu.wordId) {
      await archiveWord(contextMenu.wordId);
      setContextMenu({ visible: false, x: 0, y: 0, wordId: null });
    }
  };

  const handleBulkArchive = async () => {
    for (const id of bulkArchiveSelected) {
      await archiveWord(id);
    }
    setBulkArchiveSelected(new Set());
    setBulkArchiveMode(false);
  };

  const toggleBulkArchiveSelect = (id: string) => {
    setBulkArchiveSelected(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const [exitingWordId, setExitingWordId] = useState<string | null>(null);


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

  const handleQuickArchive = async (e: React.MouseEvent, wordId: string) => {
    e.stopPropagation();
    await archiveWord(wordId);
  };

  const renderWordCard = (word: VocabularyWord, section: NavSection = 'NEED_TO_LEARN') => {
    const isCelebrating = celebratingWordId === word.id;
    const isExiting = exitingWordId === word.id;
    const tagColor = word.source_tag ? getTagColor(word.source_tag) : null;
    const isNeedToUse = section === 'NEED_TO_USE';
    const isWeeklySelected = weeklySelected.includes(word.id);
    const isBulkSelected = bulkArchiveSelected.has(word.id);

    return (
      <div
        key={word.id}
        draggable={!isReadOnly && !weeklyMode && !bulkArchiveMode}
        onDragStart={!isReadOnly && !weeklyMode && !bulkArchiveMode ? (e) => handleDragStart(e, word.id) : undefined}
        onClick={weeklyMode ? (e) => toggleWeeklySelect(word.id, e) : bulkArchiveMode ? () => toggleBulkArchiveSelect(word.id) : () => setSelectedWord(word)}
        onContextMenu={!isReadOnly && !weeklyMode && !bulkArchiveMode ? (e) => handleContextMenu(e, word.id) : undefined}
        className={`group relative bg-zinc-800/50 border rounded-lg p-4 transition-all cursor-pointer ${
          weeklyMode
            ? isWeeklySelected
              ? 'border-amber-500/60 bg-amber-500/5 ring-1 ring-amber-500/30'
              : 'border-zinc-700/50 hover:border-amber-500/30'
            : bulkArchiveMode
              ? isBulkSelected
                ? 'border-red-500/60 bg-red-500/5 ring-1 ring-red-500/30'
                : 'border-zinc-700/50 hover:border-red-500/30'
              : isReadOnly
                ? ''
                : 'cursor-grab active:cursor-grabbing'
        } ${
          !weeklyMode && !bulkArchiveMode && (isNeedToUse ? 'border-teal-900/30 hover:border-teal-800/50' : 'border-zinc-700/50 hover:border-zinc-600')
        } ${isCelebrating ? 'animate-celebrate' : ''} ${isExiting ? 'animate-card-exit' : 'animate-card-enter'}`}
      >
        {/* Weekly mode checkbox */}
        {weeklyMode && (
          <div className={`absolute top-3 right-3 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
            isWeeklySelected ? 'bg-amber-500 border-amber-500' : 'border-zinc-600'
          }`}>
            {isWeeklySelected && <Check size={11} className="text-zinc-900" />}
          </div>
        )}

        {/* Bulk archive mode checkbox */}
        {bulkArchiveMode && (
          <div className={`absolute top-3 right-3 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
            isBulkSelected ? 'bg-red-500 border-red-500' : 'border-zinc-600'
          }`}>
            {isBulkSelected && <Check size={11} className="text-zinc-900" />}
          </div>
        )}

        {/* Normal move button and quick archive (hidden in weekly/bulk archive mode) */}
        {!isReadOnly && !weeklyMode && !bulkArchiveMode && (
          <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
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
      </div>
    );
  };

  return (
    <>
      <div className="flex gap-8">
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
                onClick={() => setActiveSection('phrases')}
                className={`px-2 py-1 rounded transition-colors ${
                  activeSection === 'phrases' ? 'bg-zinc-800 text-zinc-300' : 'hover:text-zinc-400'
                }`}
              >
                phrases
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

            {/* Words sub-nav (3 categories + phrases drop target) */}
            {activeSection === 'words' && (
              <div className="space-y-1">
                {NAV_SECTIONS.map(({ key, label }) => (
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
                        await updateWord(wordId, { ...getWordUpdatesForSection(key), word_type: 'word' });
                        setActiveNavSection(key);
                      }
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      activeNavSection === key
                        ? 'bg-zinc-800 text-zinc-100'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'
                    } ${dragOverSection === key ? 'ring-2 ring-teal-500/50 bg-zinc-800/60' : ''}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Phrases drop target shown when viewing words */}
            {activeSection === 'words' && (
              <div
                onDragOver={(e) => { handleDragOver(e); setDragOverPhrases(true); }}
                onDragLeave={() => setDragOverPhrases(false)}
                onDrop={handleDropOnPhrases}
                className={`w-full px-3 py-2 rounded-lg text-xs transition-all border border-dashed mt-3 ${
                  dragOverPhrases
                    ? 'border-zinc-500 bg-zinc-800/60 text-zinc-400'
                    : 'border-zinc-800 text-zinc-700'
                }`}
              >
                drop here → phrases
              </div>
            )}

            {/* Phrases: drop back to word categories */}
            {activeSection === 'phrases' && (
              <div className="space-y-1">
                {NAV_SECTIONS.map(({ key, label }) => (
                  <div
                    key={key}
                    onDragOver={(e) => { handleDragOver(e); setDragOverSection(key); }}
                    onDragLeave={() => setDragOverSection(null)}
                    onDrop={async (e) => {
                      e.preventDefault();
                      setDragOverSection(null);
                      const wordId = e.dataTransfer.getData('wordId');
                      if (wordId) {
                        await updateWord(wordId, { ...getWordUpdatesForSection(key), word_type: 'word' });
                        setActiveSection('words');
                        setActiveNavSection(key);
                      }
                    }}
                    className={`w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all border border-dashed text-zinc-700 border-zinc-800 ${
                      dragOverSection === key ? 'border-zinc-500 bg-zinc-800/60 text-zinc-400' : ''
                    }`}
                  >
                    {label}
                  </div>
                ))}
              </div>
            )}

            {/* Archive link */}
            {archived.length > 0 && (
              <button
                onClick={() => setActiveSection('archive')}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors mt-4 ${
                  activeSection === 'archive' ? 'text-zinc-400' : 'text-zinc-700 hover:text-zinc-500'
                }`}
              >
                archive
              </button>
            )}

          </nav>
        </aside>

        <main className="flex-1 min-w-0">
          {/* Bulk archive button for non-archive sections */}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeWords.map((word) => renderWordCard(word, activeNavSection))}
                </div>
              )}
            </>
          ) : activeSection === 'phrases' ? (
            <>
              {phrases.length === 0 ? (
                <div className="text-zinc-600 text-sm italic py-8">No phrases yet. Drag a word onto the Phrases target in the sidebar to move it here.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {phrases.map((phrase) => renderWordCard(phrase))}
                </div>
              )}
            </>
          ) : activeSection === 'archive' ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-zinc-500 text-xs">Archived items can be restored by editing them.</p>
                {bulkArchiveMode && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setBulkArchiveMode(false); setBulkArchiveSelected(new Set()); }}
                      className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors px-2 py-1 rounded"
                    >
                      Cancel
                    </button>
                  </div>
                )}
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
                        className="bg-zinc-800/30 border border-zinc-700/50 rounded-lg p-4 hover:border-zinc-600 transition-colors cursor-pointer opacity-75 hover:opacity-100"
                      >
                        <div className="flex-1 min-w-0">
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
                        {/* Bulk archive mode checkbox */}
                        {bulkArchiveMode && (
                          <div className={`absolute top-3 right-3 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                            isBulkSelected ? 'bg-red-500 border-red-500' : 'border-zinc-600'
                          }`}>
                            {isBulkSelected && <Check size={11} className="text-zinc-900" />}
                          </div>
                        )}
                        
                        {/* Quick archive button */}
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
          isReadOnly={isReadOnly}
        />
      )}

      <Confetti
        active={confettiOrigin !== null}
        originX={confettiOrigin?.x}
        originY={confettiOrigin?.y}
        onComplete={handleConfettiComplete}
      />

      {/* Bulk archive floating bar */}
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

      {/* Weekly mode floating bar */}
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
    </>
  );
}
