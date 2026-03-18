import { useState } from 'react';
import { X, Check, ChevronRight } from 'lucide-react';
import { VocabularyWord } from '../lib/supabase';

export interface WeeklyDoneEntry {
  id: string;
  sentence?: string;
}

interface WeeklyReviewProps {
  selectedWords: VocabularyWord[];
  done: WeeklyDoneEntry[];
  onToggleDone: (id: string) => void;
  onSaveSentence: (id: string, sentence: string) => void;
  onChangeWords: () => void;
  onClose: () => void;
}

export default function WeeklyReview({ selectedWords, done, onToggleDone, onSaveSentence, onChangeWords, onClose }: WeeklyReviewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    done.forEach(d => { if (d.sentence) init[d.id] = d.sentence; });
    return init;
  });

  const doneIds = new Set(done.map(d => d.id));
  const usedCount = done.length;

  const handleCheck = (id: string) => {
    onToggleDone(id);
    if (!doneIds.has(id)) setExpandedId(id); // expand for sentence on check
    else setExpandedId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end pt-16 pr-4" onClick={onClose}>
      <div
        className="w-80 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div>
            <h2 className="text-sm font-medium text-zinc-100">This week</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {usedCount}/{selectedWords.length} used in speech
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Word list */}
        <div className="max-h-[65vh] overflow-y-auto">
          {selectedWords.length === 0 ? (
            <div className="px-5 py-6 text-center text-zinc-600 text-sm">No words selected yet.</div>
          ) : (
            <div className="divide-y divide-zinc-800/60">
              {selectedWords.map(w => {
                const isDone = doneIds.has(w.id);
                const isExpanded = expandedId === w.id;
                const existingSentence = done.find(d => d.id === w.id)?.sentence;

                return (
                  <div key={w.id} className="px-5 py-3">
                    <div className="flex items-start gap-3">
                      {/* Check circle */}
                      <button
                        onClick={() => handleCheck(w.id)}
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                          isDone ? 'bg-amber-500 border-amber-500' : 'border-zinc-600 hover:border-amber-500/60'
                        }`}
                      >
                        {isDone && <Check size={11} className="text-zinc-900" />}
                      </button>

                      {/* Word + sentence toggle */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-sm ${isDone ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>
                            {w.word}
                          </span>
                          {isDone && (
                            <button
                              onClick={() => setExpandedId(isExpanded ? null : w.id)}
                              className="text-zinc-600 hover:text-zinc-400 transition-colors flex-shrink-0"
                            >
                              <ChevronRight size={14} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                            </button>
                          )}
                        </div>
                        {w.definition && (
                          <p className="text-xs text-zinc-600 truncate mt-0.5">{w.definition}</p>
                        )}

                        {/* Sentence input — shown when just checked or expanded */}
                        {isExpanded && (
                          <div className="mt-2">
                            <textarea
                              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-300 placeholder-zinc-600 resize-none focus:outline-none focus:border-amber-500/50 transition-colors"
                              rows={2}
                              placeholder="Write the sentence you used it in… (optional)"
                              value={drafts[w.id] ?? existingSentence ?? ''}
                              onChange={e => setDrafts(prev => ({ ...prev, [w.id]: e.target.value }))}
                              onBlur={() => {
                                const val = drafts[w.id] ?? '';
                                onSaveSentence(w.id, val);
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-800 flex items-center justify-between">
          <button
            onClick={onChangeWords}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Change words
          </button>
          {usedCount === selectedWords.length && selectedWords.length > 0 && (
            <span className="text-xs text-amber-400">All done this week 🎉</span>
          )}
        </div>
      </div>
    </div>
  );
}
