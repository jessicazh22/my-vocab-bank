import { useState } from 'react';
import { X, AlertTriangle, Loader2, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { VocabularyWord } from '../lib/supabase';

interface QuickAddProps {
  onClose: () => void;
  addWord: (word: string, definition: string, options?: {
    exampleSentence?: string; context?: string; usageHint?: string;
    sourceTag?: string; scaffoldPrompt?: string;
    wordType?: 'word' | 'phrase' | 'sentence';
  }) => Promise<void>;
  checkDuplicate: (word: string) => Promise<VocabularyWord | null>;
}

interface DuplicateInfo {
  existingWord: VocabularyWord;
  newWord: string;
  newDefinition?: string;
  newExample?: string;
  newSourceTag?: string;
}

type AddMode = 'word' | 'sentence';

// --- Attribution parsing ---

function toTitleCase(str: string): string {
  const minor = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'by', 'in', 'of', 'up', 'as']);
  return str
    .toLowerCase()
    .split(' ')
    .map((w, i) => (i === 0 || !minor.has(w)) ? w.charAt(0).toUpperCase() + w.slice(1) : w)
    .join(' ');
}

interface ParsedAttribution {
  sentence: string;
  author?: string;
  book?: string;
  page?: string;
  sourceTag?: string;
}

function parseAttribution(raw: string): ParsedAttribution {
  const text = raw.trim();

  // Find attribution at end: "sentence -- Author, Book, pg. X"
  // The marker (--, —, ~) must be followed by a capital letter (author name heuristic)
  // Lazy match so we find the LAST marker before a capital-letter attribution
  const dashMatch = text.match(/^([\s\S]+?)\s*(?:--|—|~)\s*([A-Z].*)$/);
  if (dashMatch) {
    const sentence = dashMatch[1].trim();
    const attr = dashMatch[2].trim();
    // Split attribution by comma: Author, Book, page/location
    const parts = attr.split(',').map(s => s.trim()).filter(Boolean);
    const author = parts[0] || undefined;
    const book = parts[1] ? toTitleCase(parts[1]) : undefined;
    const page = parts.slice(2).join(', ').trim() || undefined;
    const sourceTag = [author, book, page].filter(Boolean).join(', ') || undefined;
    return { sentence, author, book, page, sourceTag };
  }

  return { sentence: text };
}

export default function QuickAdd({ onClose, addWord, checkDuplicate }: QuickAddProps) {
  const [mode, setMode] = useState<AddMode>('word');

  // Word/phrase fields
  const [input, setInput] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [exampleSentence, setExampleSentence] = useState('');
  const [sourceTag, setSourceTag] = useState('');

  // Sentence field (single textarea)
  const [sentenceInput, setSentenceInput] = useState('');

  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateInfo | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addingStatus, setAddingStatus] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const enrichWord = async (word: string, isPhrase: boolean) => {
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enrich-word`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(isPhrase ? { word, shortPhraseOnly: true } : { word, defineOnly: true }),
      });
      const data = await response.json();
      return {
        definition: data.definition || undefined,
        examples: data.examples as string[] | undefined,
        context: data.context as string | undefined,
        scaffoldPrompt: data.scaffoldPrompt as string | undefined,
      };
    } catch {
      return {};
    }
  };

  const flashSuccess = (clearFn: () => void) => {
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      clearFn();
    }, 1500);
  };

  // --- Word/phrase submit ---
  const handleWordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Only split on — if it looks like "word — definition" (short left side)
    const dashIndex = input.indexOf('—');
    let word: string;
    let definition: string | undefined;

    if (dashIndex > 0 && dashIndex < 40) {
      word = input.slice(0, dashIndex).trim();
      definition = input.slice(dashIndex + 1).trim() || undefined;
    } else {
      word = input.trim();
      definition = undefined;
    }

    const existing = await checkDuplicate(word);
    if (existing) {
      setDuplicateInfo({
        existingWord: existing,
        newWord: word,
        newDefinition: definition,
        newExample: exampleSentence || undefined,
        newSourceTag: sourceTag || undefined,
      });
      return;
    }

    await doAddWord(word, definition);
  };

  const doAddWord = async (word: string, definition?: string) => {
    setIsAdding(true);

    try {
      let finalDefinition = definition || '';
      let aiExamples: string[] | undefined;
      let aiContext: string | undefined;
      let aiScaffold: string | undefined;

      // No user-provided definition — auto-generate short definition + examples + context
      if (!definition) {
        setAddingStatus('Finding definition...');
        const isPhrase = word.includes(' ');
        const enriched = await enrichWord(word, isPhrase);
        finalDefinition = enriched.definition || '';
        aiExamples = enriched.examples;
        aiContext = enriched.context;
        aiScaffold = enriched.scaffoldPrompt;
      }

      setAddingStatus('Adding...');
      const userExample = exampleSentence ? `[yours] ${exampleSentence}` : undefined;
      // Merge user example + AI examples
      const finalExample = userExample
        ? aiExamples?.length
          ? `${userExample} / ${aiExamples.slice(0, 2).join(' / ')}`
          : userExample
        : aiExamples?.slice(0, 3).join(' / ');

      // Explicitly cap word_type at 'phrase' — never let length-based heuristics mark it as 'sentence'
      const wordType = word.includes(' ') ? 'phrase' : 'word';

      await addWord(word, finalDefinition, {
        exampleSentence: finalExample,
        context: aiContext,
        scaffoldPrompt: aiScaffold,
        sourceTag: sourceTag || undefined,
        wordType,
      });

      setIsAdding(false);
      setAddingStatus('');
      flashSuccess(() => {
        setInput('');
        setExampleSentence('');
        setSourceTag('');
        setShowMore(false);
      });
    } catch (err) {
      setIsAdding(false);
      setAddingStatus('');
      const errorMessage = err instanceof Error ? err.message : 'Failed to add word';
      // Show error message to user
      alert(errorMessage);
    }
  };

  // --- Sentence submit ---
  const handleSentenceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sentenceInput.trim()) return;

    const parsed = parseAttribution(sentenceInput);

    setIsAdding(true);
    setAddingStatus('Adding sentence...');

    try {
      await addWord(parsed.sentence, '', {
        sourceTag: parsed.sourceTag,
        wordType: 'sentence',
      });

      setIsAdding(false);
      setAddingStatus('');
      flashSuccess(() => {
        setSentenceInput('');
      });
    } catch (err) {
      setIsAdding(false);
      setAddingStatus('');
      const errorMessage = err instanceof Error ? err.message : 'Failed to add sentence';
      alert(errorMessage);
    }
  };

  const handleAddAnyway = async () => {
    if (!duplicateInfo) return;
    setDuplicateInfo(null);
    await doAddWord(duplicateInfo.newWord, duplicateInfo.newDefinition);
  };

  const handleCancelDuplicate = () => {
    setDuplicateInfo(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (mode === 'word') {
        handleWordSubmit(e as any);
      } else {
        handleSentenceSubmit(e as any);
      }
    }
  };

  const switchMode = (newMode: AddMode) => {
    setMode(newMode);
    setDuplicateInfo(null);
  };

  // Live attribution preview for sentence mode
  const parsedAttribution = parseAttribution(sentenceInput);
  const hasAttribution = !!(parsedAttribution.author || parsedAttribution.book || parsedAttribution.page);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-800 rounded-xl w-full max-w-lg border border-zinc-700">
        <div className="flex items-center justify-between p-6 border-b border-zinc-700">
          <div className="flex items-center gap-3">
            <button
              onClick={() => switchMode('word')}
              className={`text-sm font-medium px-2.5 py-1 rounded transition-colors ${
                mode === 'word'
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Word / Phrase
            </button>
            <button
              onClick={() => switchMode('sentence')}
              className={`text-sm font-medium px-2.5 py-1 rounded transition-colors ${
                mode === 'sentence'
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Sentence
            </button>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {duplicateInfo ? (
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-3 p-4 bg-amber-900/20 border border-amber-700/50 rounded-lg">
              <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={20} />
              <div className="space-y-2">
                <p className="text-amber-200 font-medium">This word already exists</p>
                <p className="text-zinc-400 text-sm">
                  "{duplicateInfo.existingWord.word}" is already in your{' '}
                  <span className="text-zinc-300 capitalize">
                    {duplicateInfo.existingWord.category.replace('_', ' ').toLowerCase()}
                  </span>{' '}
                  section.
                </p>
                <div className="mt-3 p-3 bg-zinc-800/50 rounded border border-zinc-700">
                  <p className="text-xs text-zinc-500 mb-1">Existing definition:</p>
                  <p className="text-zinc-300 text-sm">{duplicateInfo.existingWord.definition}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCancelDuplicate}
                className="flex-1 py-3 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddAnyway}
                className="flex-1 py-3 bg-amber-700 hover:bg-amber-600 text-zinc-100 rounded-lg transition-colors"
              >
                Add Anyway
              </button>
            </div>
          </div>
        ) : mode === 'word' ? (
          <form onSubmit={handleWordSubmit} className="p-6 space-y-4">
            <div>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a word or phrase"
                className="w-full px-4 py-3 bg-zinc-900 text-zinc-100 rounded-lg border border-zinc-700 focus:outline-none focus:border-zinc-500 text-lg"
                autoFocus
                spellCheck
                autoCorrect="on"
                disabled={isAdding || showSuccess}
              />
              <p className="text-xs text-zinc-600 mt-2">
                Just the word is enough! Or use <span className="text-zinc-500">word — definition</span> to add your own.
              </p>
            </div>

            {!isAdding && !showSuccess && (
              <button
                type="button"
                onClick={() => setShowMore(!showMore)}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showMore ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {showMore ? 'Less' : 'More details (optional)'}
              </button>
            )}

            {showMore && !isAdding && !showSuccess && (
              <div className="space-y-3">
                <textarea
                  value={exampleSentence}
                  onChange={(e) => setExampleSentence(e.target.value)}
                  placeholder="Your example sentence (optional)"
                  rows={2}
                  spellCheck
                  autoCorrect="on"
                  className="w-full px-4 py-3 bg-zinc-900 text-zinc-100 rounded-lg border border-zinc-700 focus:outline-none focus:border-zinc-500 resize-none text-sm"
                />
                <input
                  type="text"
                  value={sourceTag}
                  onChange={(e) => setSourceTag(e.target.value)}
                  placeholder="Source — e.g., George Saunders"
                  className="w-full px-4 py-3 bg-zinc-900 text-zinc-100 rounded-lg border border-zinc-700 focus:outline-none focus:border-zinc-500 text-sm"
                />
              </div>
            )}

            {isAdding ? (
              <div className="flex items-center justify-center gap-2 py-3 text-zinc-400">
                <Loader2 size={18} className="animate-spin" />
                <span className="text-sm">{addingStatus}</span>
              </div>
            ) : showSuccess ? (
              <div className="flex items-center justify-center gap-2 py-3 text-emerald-400">
                <Check size={18} />
                <span className="text-sm font-medium">Added!</span>
              </div>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="w-full py-3 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Add
              </button>
            )}
          </form>
        ) : (
          <form onSubmit={handleSentenceSubmit} className="p-6 space-y-4">
            <div>
              <textarea
                value={sentenceInput}
                onChange={(e) => setSentenceInput(e.target.value)}
                placeholder="Paste the sentence here..."
                rows={5}
                className="w-full px-4 py-3 bg-zinc-900 text-zinc-100 rounded-lg border border-zinc-700 focus:outline-none focus:border-zinc-500 resize-none text-sm leading-relaxed"
                autoFocus
                spellCheck
                autoCorrect="on"
                disabled={isAdding || showSuccess}
              />
              <p className="text-xs text-zinc-600 mt-2">
                Add attribution at the end:{' '}
                <span className="text-zinc-500">-- Author, Book, pg. 39</span>
              </p>

              {/* Live attribution preview */}
              {sentenceInput.trim() && hasAttribution && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-zinc-400">
                  <span className="text-zinc-600">↳</span>
                  <span>
                    {[parsedAttribution.author, parsedAttribution.book, parsedAttribution.page]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
              )}
            </div>

            {isAdding ? (
              <div className="flex items-center justify-center gap-2 py-3 text-zinc-400">
                <Loader2 size={18} className="animate-spin" />
                <span className="text-sm">{addingStatus}</span>
              </div>
            ) : showSuccess ? (
              <div className="flex items-center justify-center gap-2 py-3 text-emerald-400">
                <Check size={18} />
                <span className="text-sm font-medium">Added!</span>
              </div>
            ) : (
              <button
                type="submit"
                disabled={!sentenceInput.trim()}
                className="w-full py-3 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Add Sentence
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
