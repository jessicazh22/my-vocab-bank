import { useState } from 'react';
import { useVocabulary } from '../lib/hooks';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import { VocabularyWord } from '../lib/supabase';

interface QuickAddProps {
  onClose: () => void;
}

interface DuplicateInfo {
  existingWord: VocabularyWord;
  newWord: string;
  newDefinition: string;
  newExample?: string;
  newContext?: string;
  newUsageHint?: string;
  newSourceTag?: string;
}

export default function QuickAdd({ onClose }: QuickAddProps) {
  const [input, setInput] = useState('');
  const [exampleSentence, setExampleSentence] = useState('');
  const [context, setContext] = useState('');
  const [usageHint, setUsageHint] = useState('');
  const [sourceTag, setSourceTag] = useState('');
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateInfo | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const { addWord, checkDuplicate } = useVocabulary();

  const enrichWord = async (word: string, definition: string) => {
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enrich-word`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ word, definition }),
      });
      const data = await response.json();
      return {
        example_sentence: data.examples?.join(' / ') || undefined,
        context: data.context || undefined,
        scaffold_prompt: data.scaffoldPrompt || undefined,
      };
    } catch {
      return {};
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parts = input.split('—').map((s) => s.trim());
    if (parts.length !== 2) {
      alert('Format should be: word — definition');
      return;
    }

    const [word, definition] = parts;

    const existing = await checkDuplicate(word);
    if (existing) {
      setDuplicateInfo({
        existingWord: existing,
        newWord: word,
        newDefinition: definition,
        newExample: exampleSentence || undefined,
        newContext: context || undefined,
        newUsageHint: usageHint || undefined,
        newSourceTag: sourceTag || undefined,
      });
      return;
    }

    setIsAdding(true);

    const enrichment = await enrichWord(word, definition);

    await addWord(
      word,
      definition,
      exampleSentence || enrichment.example_sentence,
      context || enrichment.context,
      usageHint || undefined,
      sourceTag || undefined,
      enrichment.scaffold_prompt
    );

    setIsAdding(false);
    setInput('');
    setExampleSentence('');
    setContext('');
    setUsageHint('');
    setSourceTag('');
  };

  const handleAddAnyway = async () => {
    if (!duplicateInfo) return;
    setIsAdding(true);

    const enrichment = await enrichWord(duplicateInfo.newWord, duplicateInfo.newDefinition);

    await addWord(
      duplicateInfo.newWord,
      duplicateInfo.newDefinition,
      duplicateInfo.newExample || enrichment.example_sentence,
      duplicateInfo.newContext || enrichment.context,
      duplicateInfo.newUsageHint,
      duplicateInfo.newSourceTag,
      enrichment.scaffold_prompt
    );

    setIsAdding(false);
    setDuplicateInfo(null);
    setInput('');
    setExampleSentence('');
    setContext('');
    setUsageHint('');
    setSourceTag('');
  };

  const handleCancelDuplicate = () => {
    setDuplicateInfo(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-800 rounded-xl w-full max-w-2xl border border-zinc-700">
        <div className="flex items-center justify-between p-6 border-b border-zinc-700">
          <h2 className="text-xl font-light text-zinc-100">Quick Add</h2>
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
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="word — definition"
                className="w-full px-4 py-3 bg-zinc-900 text-zinc-100 rounded-lg border border-zinc-700 focus:outline-none focus:border-zinc-500"
                autoFocus
              />
              <p className="text-xs text-zinc-500 mt-2">Press Enter to add, or continue below</p>
            </div>

            <div>
              <textarea
                value={exampleSentence}
                onChange={(e) => setExampleSentence(e.target.value)}
                placeholder="Example sentence (optional)"
                rows={2}
                className="w-full px-4 py-3 bg-zinc-900 text-zinc-100 rounded-lg border border-zinc-700 focus:outline-none focus:border-zinc-500 resize-none"
              />
            </div>

            <div>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Context (optional) — e.g., business settings, formal writing..."
                rows={2}
                className="w-full px-4 py-3 bg-zinc-900 text-zinc-100 rounded-lg border border-zinc-700 focus:outline-none focus:border-zinc-500 resize-none"
              />
            </div>

            <div>
              <textarea
                value={usageHint}
                onChange={(e) => setUsageHint(e.target.value)}
                placeholder="When to use (optional) — e.g., Use when describing someone gazing with wonder..."
                rows={2}
                className="w-full px-4 py-3 bg-zinc-900 text-zinc-100 rounded-lg border border-zinc-700 focus:outline-none focus:border-zinc-500 resize-none"
              />
            </div>

            <div>
              <input
                type="text"
                value={sourceTag}
                onChange={(e) => setSourceTag(e.target.value)}
                placeholder="Source (optional) — e.g., George Saunders - A Swim in a Pond in the Rain"
                className="w-full px-4 py-3 bg-zinc-900 text-zinc-100 rounded-lg border border-zinc-700 focus:outline-none focus:border-zinc-500"
              />
            </div>

            <button
              type="submit"
              disabled={isAdding}
              className="w-full py-3 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isAdding ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Word'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
