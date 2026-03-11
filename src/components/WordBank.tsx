import { useState, useRef, useEffect } from 'react';
import { VocabularyWord } from '../lib/supabase';
import { Trash2, BookOpen, RotateCcw, BookMarked, Heart } from 'lucide-react';
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

type Category = 'KNOW_WELL' | 'LEARNING' | 'JUST_ADDED';
type Familiarity = 'NEED_TO_LEARN' | 'NEED_TO_USE';

interface WordBankProps {
  words: VocabularyWord[];
  updateWord: (id: string, updates: Partial<VocabularyWord>) => Promise<void>;
  deleteWord: (id: string) => Promise<void>;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  wordId: string | null;
}

const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'JUST_ADDED', label: 'Just Added' },
  { key: 'LEARNING', label: 'Learning' },
  { key: 'KNOW_WELL', label: 'Know Well' },
];

export default function WordBank({ words, updateWord, deleteWord }: WordBankProps) {
  const [activeSection, setActiveSection] = useState<'words' | 'sentences'>('words');
  const [activeCategory, setActiveCategory] = useState<Category>('JUST_ADDED');
  const [selectedWord, setSelectedWord] = useState<VocabularyWord | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<Category | null>(null);
  const [dragOverFamiliarity, setDragOverFamiliarity] = useState<Familiarity | null>(null);
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

  const getWordsByCategory = (category: Category) => {
    return wordsAndPhrases.filter((w) => w.category === category);
  };

  const getLearningWordsByFamiliarity = (familiarity: Familiarity) => {
    return wordsAndPhrases.filter(
      (w) => w.category === 'LEARNING' && w.familiarity === familiarity
    );
  };

  const activeWords = getWordsByCategory(activeCategory);
  const needToLearnWords = getLearningWordsByFamiliarity('NEED_TO_LEARN');
  const needToUseWords = getLearningWordsByFamiliarity('NEED_TO_USE');

  const handleDragStart = (e: React.DragEvent, wordId: string) => {
    e.dataTransfer.setData('wordId', wordId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnCategory = async (e: React.DragEvent, category: Category) => {
    e.preventDefault();
    setDragOverCategory(null);
    const wordId = e.dataTransfer.getData('wordId');
    if (wordId) {
      await updateWord(wordId, { category });
    }
  };

  const handleDropOnFamiliarity = async (e: React.DragEvent, familiarity: Familiarity) => {
    e.preventDefault();
    setDragOverFamiliarity(null);
    const wordId = e.dataTransfer.getData('wordId');
    if (wordId) {
      await updateWord(wordId, { familiarity });
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

  const handleFamiliarityToggle = async (e: React.MouseEvent, wordId: string, newFamiliarity: Familiarity) => {
    e.stopPropagation();

    if (newFamiliarity === 'NEED_TO_USE') {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setConfettiOrigin({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    }

    setCelebratingWordId(wordId);
    setTimeout(async () => {
      await updateWord(wordId, { familiarity: newFamiliarity });
      setCelebratingWordId(null);
    }, 500);
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

  const renderWordCard = (word: VocabularyWord, isNeedToUse = false) => {
    const isCelebrating = celebratingWordId === word.id;
    const tagColor = word.source_tag ? getTagColor(word.source_tag) : null;

    return (
      <div
        key={word.id}
        draggable
        onDragStart={(e) => handleDragStart(e, word.id)}
        onClick={() => setSelectedWord(word)}
        onContextMenu={(e) => handleContextMenu(e, word.id)}
        className={`group relative bg-zinc-800/50 border rounded-lg p-4 transition-all cursor-grab active:cursor-grabbing ${
          isNeedToUse ? 'border-teal-900/30 hover:border-teal-800/50' : 'border-zinc-700/50 hover:border-zinc-600'
        } ${isCelebrating ? 'animate-celebrate' : ''}`}
      >
        <button
          onClick={(e) => handleFamiliarityToggle(
            e,
            word.id,
            isNeedToUse ? 'NEED_TO_LEARN' : 'NEED_TO_USE'
          )}
          className={`absolute top-2 right-2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-all ${
            isNeedToUse
              ? 'text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10'
              : 'text-zinc-500 hover:text-teal-400 hover:bg-teal-500/10'
          }`}
          title={isNeedToUse ? 'Move back to Need to Learn' : 'I know this!'}
        >
          {isNeedToUse ? <RotateCcw size={14} /> : <BookOpen size={14} />}
        </button>
        <div className="flex-1 min-w-0 pr-6">
          <div className="text-zinc-100 text-sm">{word.word}</div>
          <div className="text-zinc-500 text-xs leading-relaxed mt-1 line-clamp-2">
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
                {CATEGORIES.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setActiveCategory(key)}
                    onDragOver={(e) => {
                      handleDragOver(e);
                      setDragOverCategory(key);
                    }}
                    onDragLeave={() => setDragOverCategory(null)}
                    onDrop={(e) => handleDropOnCategory(e, key)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      activeCategory === key
                        ? 'bg-zinc-800 text-zinc-100'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'
                    } ${dragOverCategory === key ? 'ring-2 ring-teal-500/50 bg-zinc-800/60' : ''}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </nav>
        </aside>

        <main className="flex-1 min-w-0">
          {activeSection === 'words' ? (
            <>
              {activeCategory === 'LEARNING' ? (
                <div className="space-y-8">
                  <div
                    onDragOver={(e) => {
                      handleDragOver(e);
                      setDragOverFamiliarity('NEED_TO_LEARN');
                    }}
                    onDragLeave={() => setDragOverFamiliarity(null)}
                    onDrop={(e) => handleDropOnFamiliarity(e, 'NEED_TO_LEARN')}
                    className={`rounded-lg transition-all ${
                      dragOverFamiliarity === 'NEED_TO_LEARN' ? 'ring-2 ring-amber-500/30 bg-amber-500/5' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-zinc-800">
                      <BookOpen size={12} className="text-amber-500" />
                      <h3 className="text-xs uppercase tracking-wider text-zinc-500 font-medium">
                        Need to Learn
                      </h3>
                      <span className="text-xs text-zinc-600">({needToLearnWords.length})</span>
                    </div>
                    {needToLearnWords.length === 0 ? (
                      <div className="text-zinc-600 text-sm italic py-4">
                        {dragOverFamiliarity === 'NEED_TO_LEARN' ? 'Drop here' : 'No words here'}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {needToLearnWords.map((word) => renderWordCard(word))}
                      </div>
                    )}
                  </div>

                  <div
                    onDragOver={(e) => {
                      handleDragOver(e);
                      setDragOverFamiliarity('NEED_TO_USE');
                    }}
                    onDragLeave={() => setDragOverFamiliarity(null)}
                    onDrop={(e) => handleDropOnFamiliarity(e, 'NEED_TO_USE')}
                    className={`rounded-lg transition-all ${
                      dragOverFamiliarity === 'NEED_TO_USE' ? 'ring-2 ring-teal-500/30 bg-teal-500/5' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-zinc-800">
                      <RotateCcw size={12} className="text-teal-500" />
                      <h3 className="text-xs uppercase tracking-wider text-zinc-500 font-medium">
                        Use More Often
                      </h3>
                      <span className="text-xs text-zinc-600">({needToUseWords.length})</span>
                    </div>
                    {needToUseWords.length === 0 ? (
                      <div className="text-zinc-600 text-sm italic py-4">
                        {dragOverFamiliarity === 'NEED_TO_USE' ? 'Drop here' : 'No words here'}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {needToUseWords.map((word) => renderWordCard(word, true))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {activeWords.length === 0 ? (
                    <div className="text-zinc-600 text-sm italic py-8">No words in this category yet</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {activeWords.map((word) => {
                        const tagColor = word.source_tag ? getTagColor(word.source_tag) : null;
                        return (
                          <div
                            key={word.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, word.id)}
                            onClick={() => setSelectedWord(word)}
                            onContextMenu={(e) => handleContextMenu(e, word.id)}
                            className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4 hover:border-zinc-600 transition-colors cursor-grab active:cursor-grabbing"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-zinc-100 text-sm">{word.word}</div>
                              <div className="text-zinc-500 text-xs leading-relaxed mt-1 line-clamp-2">
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
                      })}
                    </div>
                  )}
                </>
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

      {contextMenu.visible && (
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

      {selectedWord && (
        <WordDetail word={selectedWord} onClose={() => setSelectedWord(null)} />
      )}

      <Confetti
        active={confettiOrigin !== null}
        originX={confettiOrigin?.x}
        originY={confettiOrigin?.y}
        onComplete={() => setConfettiOrigin(null)}
      />
    </>
  );
}
