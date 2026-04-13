import { useState } from 'react';
import { X, AlertTriangle, Loader2, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { VocabularyWord, callEdgeFunction } from '../lib/supabase';

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
  const dashMatch = text.match(/^([\s\S]+?)\s*(?:--|—|~)\s*([A-Z].*)$/);
  if (dashMatch) {
    const sentence = dashMatch[1].trim();
    const attr = dashMatch[2].trim();
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
  const [input, setInput] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [exampleSentence, setExampleSentence] = useState('');
  const [sourceTag, setSourceTag] = useState('');
  const [sentenceInput, setSentenceInput] = useState('');
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateInfo | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addingStatus, setAddingStatus] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [correctionInfo, setCorrectionInfo] = useState<{ original: string; corrected: string } | null>(null);

  const enrichWord = async (word: string, isPhrase: boolean) => {
    try {
      const data = await callEdgeFunction<any>('enrich-word', isPhrase ? { word, shortPhraseOnly: true } : { word, defineOnly: true });
      return {
        definition: data.definition || undefined,
        examples: data.examples as string[] | undefined,
        context: data.context as string | undefined,
        scaffoldPrompt: data.scaffoldPrompt as string | undefined,
        correction: data.correction as string | null | undefined,
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

  const handleWordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

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

  const doAddWord = async (inputWord: string, definition?: string) => {
    setIsAdding(true);
    setCorrectionInfo(null);

    let word = inputWord;
    let finalDefinition = definition || '';
    let aiExamples: string[] | undefined;
    let aiContext: string | undefined;
    let aiScaffold: string | undefined;

    if (!definition) {
      setAddingStatus('Finding definition...');
      const isPhrase = inputWord.includes(' ');
      const enriched = await enrichWord(inputWord, isPhrase);
      finalDefinition = enriched.definition || '';
      aiExamples = enriched.examples;
      aiContext = enriched.context;
      aiScaffold = enriched.scaffoldPrompt;

      // Apply spelling correction if the model detected one
      if (enriched.correction && enriched.correction.toLowerCase() !== inputWord.toLowerCase()) {
        word = enriched.correction;
        setCorrectionInfo({ original: inputWord, corrected: enriched.correction });
        setInput(enriched.correction);
      }
    }

    setAddingStatus('Adding...');
    const userExample = exampleSentence ? `[yours] ${exampleSentence}` : undefined;
    const finalExample = userExample
      ? aiExamples?.length
        ? `${userExample} / ${aiExamples.slice(0, 2).join(' / ')}`
        : userExample
      : aiExamples?.slice(0, 3).join(' / ');

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
      setCorrectionInfo(null);
    });
  };

  const handleSentenceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sentenceInput.trim()) return;

    const parsed = parseAttribution(sentenceInput);
    setIsAdding(true);
    setAddingStatus('Adding sentence...');

    await addWord(parsed.sentence, '', {
      sourceTag: parsed.sourceTag,
      wordType: 'sentence',
    });

    setIsAdding(false);
    setAddingStatus('');
    flashSuccess(() => setSentenceInput(''));
  };

  const handleAddAnyway = async () => {
    if (!duplicateInfo) return;
    setDuplicateInfo(null);
    await doAddWord(duplicateInfo.newWord, duplicateInfo.newDefinition);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (mode === 'word') handleWordSubmit(e as any);
      else handleSentenceSubmit(e as any);
    }
  };

  const parsedAttribution = parseAttribution(sentenceInput);
  const hasAttribution = !!(parsedAttribution.author || parsedAttribution.book || parsedAttribution.page);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-800 rounded-xl w-full max-w-lg border border-zinc-700">
        <div className="flex items-center justify-between p-6 border-b border-zinc-700">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setMode('word'); setDuplicateInfo(null); }}
              className={`text-sm font-medium px-2.5 py-1 rounded transition-colors ${
                mode === 'word' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Word / Phrase
            </button>
            <button
              onClick={() => { setMode('sentence'); setDuplicateInfo(null); }}
              className={`text-sm font-medium px-2.5 py-1 rounded transition-colors ${
                mode === 'sentence' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Sentence
            </button>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-100 transition-colors">
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
                  </span>{' '}section.
                </p>
                <div className="mt-3 p-3 bg-zinc-800/50 rounded border border-zinc-700">
                  <p className="text-xs text-zinc-500 mb-1">Existing definition:</p>
                  <p className="text-zinc-300 text-sm">{duplicateInfo.existingWord.definition}</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDuplicateInfo(null)} className="flex-1 py-3 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-lg transition-colors">Cancel</button>
              <button onClick={handleAddAnyway} className="flex-1 py-3 bg-amber-700 hover:bg-amber-600 text-zinc-100 rounded-lg transition-colors">Add Anyway</button>
            </div>
          </div>
        ) : mode === 'word' ? (
          <form onSubmit={handleWordSubmit} className="p-6 space-y-4">
            <div>
              <input
                type="text"
                value={input}
                onChange={(e) => { setInput(e.target.value); setCorrectionInfo(null); }}
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

            {correctionInfo && !isAdding && (
              <p className="text-xs text-zinc-400">
                Corrected{' '}
                <span className="line-through text-zinc-600">{correctionInfo.original}</span>
                {' → '}
                <span className="text-zinc-200">{correctionInfo.corrected}</span>
              </p>
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
              <button type="submit" disabled={!input.trim()} className="w-full py-3 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
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
                Add attribution at the end: <span className="text-zinc-500">-- Author, Book, pg. 39</span>
              </p>
              {sentenceInput.trim() && hasAttribution && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-zinc-400">
                  <span className="text-zinc-600">↳</span>
                  <span>{[parsedAttribution.author, parsedAttribution.book, parsedAttribution.page].filter(Boolean).join(' · ')}</span>
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
              <button type="submit" disabled={!sentenceInput.trim()} className="w-full py-3 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                Add Sentence
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
