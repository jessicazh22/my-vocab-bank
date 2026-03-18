import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { VocabularyWord } from '../lib/supabase';

interface WeeklyChallengeProps {
  words: VocabularyWord[];
  onClose: () => void;
}

const STORAGE_KEY = 'weekly-challenge';

interface ChallengeState {
  selected: string[];   // word ids picked for this week
  done: string[];       // word ids marked as used
  weekStart: string;    // ISO date string of Monday this was set
}

function getThisMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

function loadState(): ChallengeState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { selected: [], done: [], weekStart: getThisMonday() };
    const parsed: ChallengeState = JSON.parse(raw);
    // Reset if it's a new week
    if (parsed.weekStart !== getThisMonday()) {
      return { selected: [], done: [], weekStart: getThisMonday() };
    }
    return parsed;
  } catch {
    return { selected: [], done: [], weekStart: getThisMonday() };
  }
}

export default function WeeklyChallenge({ words, onClose }: WeeklyChallengeProps) {
  const [state, setState] = useState<ChallengeState>(loadState);

  const useMoreOften = words.filter(
    w => w.familiarity === 'NEED_TO_USE' && w.word_type !== 'sentence'
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const toggleSelected = (id: string) => {
    setState(prev => ({
      ...prev,
      selected: prev.selected.includes(id)
        ? prev.selected.filter(x => x !== id)
        : [...prev.selected, id],
      done: prev.done.filter(x => x !== id), // unmark done if deselected
    }));
  };

  const toggleDone = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setState(prev => ({
      ...prev,
      done: prev.done.includes(id)
        ? prev.done.filter(x => x !== id)
        : [...prev.done, id],
    }));
  };

  const selectedWords = useMoreOften.filter(w => state.selected.includes(w.id));
  const unselectedWords = useMoreOften.filter(w => !state.selected.includes(w.id));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end" onClick={onClose}>
      <div
        className="mt-16 mr-4 w-80 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div>
            <h2 className="text-sm font-medium text-zinc-100">This week</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Pick words to use in your speech</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto">
          {/* Selected words */}
          {selectedWords.length > 0 && (
            <div className="px-5 py-3 border-b border-zinc-800/60">
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
                This week · {state.done.length}/{selectedWords.length} used
              </p>
              <div className="space-y-1.5">
                {selectedWords.map(w => {
                  const isDone = state.done.includes(w.id);
                  return (
                    <div
                      key={w.id}
                      className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-zinc-800/50 cursor-pointer transition-colors"
                      onClick={() => toggleSelected(w.id)}
                    >
                      {/* Done checkbox */}
                      <button
                        onClick={e => toggleDone(w.id, e)}
                        className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${
                          isDone
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                            : 'border-zinc-600 hover:border-zinc-400'
                        }`}
                      >
                        {isDone && <Check size={11} />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <span className={`text-sm transition-colors ${isDone ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>
                          {w.word}
                        </span>
                        {w.definition && (
                          <p className="text-xs text-zinc-600 truncate">{w.definition}</p>
                        )}
                      </div>
                      <span className="text-zinc-700 text-xs">×</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Unselected use-more-often words */}
          {unselectedWords.length > 0 ? (
            <div className="px-5 py-3">
              {selectedWords.length > 0 && (
                <p className="text-xs text-zinc-600 uppercase tracking-wider mb-2">Add more</p>
              )}
              <div className="space-y-1">
                {unselectedWords.map(w => (
                  <div
                    key={w.id}
                    className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-zinc-800/50 cursor-pointer transition-colors group"
                    onClick={() => toggleSelected(w.id)}
                  >
                    <div className="w-5 h-5 rounded-full border border-zinc-700 group-hover:border-zinc-500 flex-shrink-0 transition-colors" />
                    <div className="min-w-0 flex-1">
                      <span className="text-sm text-zinc-300 group-hover:text-zinc-100 transition-colors">{w.word}</span>
                      {w.definition && (
                        <p className="text-xs text-zinc-600 truncate">{w.definition}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : selectedWords.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-zinc-600 text-sm">No words in "Use More Often" yet.</p>
              <p className="text-zinc-700 text-xs mt-1">Move words there from "Need to Learn".</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
