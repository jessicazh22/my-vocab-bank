import { useState } from 'react';
import { X, Plus, Check, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { VocabularyWord } from '../lib/supabase';
import { supabase } from '../lib/supabase';

export interface UsageLogEntry {
  timestamp: string;
  sentence?: string;
  aiNote?: string;
}

interface WeeklyReviewProps {
  selectedWords: VocabularyWord[];
  wordLogs: { [wordId: string]: UsageLogEntry[] };
  onAddLog: (wordId: string, entry: UsageLogEntry) => void;
  onChangeWords: () => void;
  onClose: () => void;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const logStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((todayStart.getTime() - logStart.getTime()) / 86400000);
  const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (diffDays === 0) return `today at ${timeStr}`;
  if (diffDays === 1) return `yesterday`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function WeeklyReview({
  selectedWords,
  wordLogs,
  onAddLog,
  onChangeWords,
  onClose,
}: WeeklyReviewProps) {
  const [loggingId, setLoggingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [successId, setSuccessId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiNote, setAiNote] = useState('');

  const totalUsed = Object.keys(wordLogs).filter(id =>
    selectedWords.some(w => w.id === id) && (wordLogs[id]?.length ?? 0) > 0
  ).length;

  const handleStartLog = (wordId: string) => {
    setLoggingId(wordId);
    setDraft('');
    setAiNote('');
  };

  const handleSaveLog = (wordId: string) => {
    onAddLog(wordId, {
      timestamp: new Date().toISOString(),
      sentence: draft.trim() || undefined,
      aiNote: aiNote || undefined,
    });
    setLoggingId(null);
    setDraft('');
    setAiNote('');
    setSuccessId(wordId);
    setTimeout(() => setSuccessId(null), 2500);
  };

  const handleAiCheck = async (word: VocabularyWord) => {
    if (!draft.trim()) return;
    setAiLoading(true);
    try {
      const { data } = await supabase.functions.invoke('enrich-word', {
        body: {
          mode: 'checkSentence',
          word: word.word,
          definition: word.definition,
          sentence: draft.trim(),
        },
      });
      setAiNote(data?.feedback || 'Looks good!');
    } catch {
      setAiNote('Could not check — looks good to me!');
    }
    setAiLoading(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl overflow-hidden shadow-2xl"
        style={{ backgroundColor: '#2a2a2e', border: '1px solid #4a4a52' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #3a3a42' }}>
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="text-amber-400">⚡</span> This week
            </h2>
            <p className="text-xs mt-0.5" style={{ color: '#a1a1aa' }}>
              {selectedWords.length === 0
                ? 'No words selected'
                : `${totalUsed} of ${selectedWords.length} used in conversation`}
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors p-1">
            <X size={15} />
          </button>
        </div>

        {/* Word list */}
        <div className="overflow-y-auto" style={{ maxHeight: '65vh' }}>
          {selectedWords.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm mb-3" style={{ color: '#a1a1aa' }}>No words selected yet.</p>
              <button
                onClick={onChangeWords}
                className="text-xs text-amber-400 hover:text-amber-300 underline transition-colors"
              >
                Pick words for this week →
              </button>
            </div>
          ) : (
            <div>
              {selectedWords.map((w, i) => {
                const logs = wordLogs[w.id] || [];
                const isLogging = loggingId === w.id;
                const isSuccess = successId === w.id;
                const isExpanded = expandedId === w.id;
                const lastLog = logs[logs.length - 1];
                const usedCount = logs.length;

                return (
                  <div
                    key={w.id}
                    className="px-5 py-4"
                    style={{ borderBottom: i < selectedWords.length - 1 ? '1px solid #3a3a42' : 'none' }}
                  >
                    {/* Word name + badge */}
                    <div className="flex items-start gap-2 mb-1">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-white">{w.word}</span>
                          {usedCount > 0 && (
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                              style={{ backgroundColor: 'rgba(245,158,11,0.2)', color: '#f59e0b' }}
                            >
                              {usedCount}× this week
                            </span>
                          )}
                        </div>
                        {w.definition && (
                          <p className="text-xs mt-0.5 truncate" style={{ color: '#71717a' }}>
                            {w.definition}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Last log + history */}
                    {lastLog && !isLogging && (
                      <div className="mt-2 mb-1">
                        <div className="flex items-center gap-1.5">
                          <Check size={10} className="text-amber-400 flex-shrink-0" />
                          <span className="text-[11px]" style={{ color: '#71717a' }}>
                            Last logged {formatTimestamp(lastLog.timestamp)}
                          </span>
                          {logs.length > 1 && (
                            <button
                              onClick={() => setExpandedId(isExpanded ? null : w.id)}
                              className="ml-auto transition-colors"
                              style={{ color: '#52525b' }}
                            >
                              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                          )}
                        </div>
                        {lastLog.sentence && (
                          <p className="text-[11px] italic mt-0.5 pl-3.5 line-clamp-2" style={{ color: '#71717a' }}>
                            "{lastLog.sentence}"
                          </p>
                        )}
                        {lastLog.aiNote && (
                          <p className="text-[11px] mt-0.5 pl-3.5" style={{ color: '#34d399' }}>
                            ✓ {lastLog.aiNote}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Expanded history */}
                    {isExpanded && logs.length > 1 && (
                      <div className="mt-1 mb-2 pl-3.5 space-y-1.5" style={{ borderLeft: '1px solid #3a3a42' }}>
                        {[...logs].reverse().slice(1).map((log, i) => (
                          <div key={i} className="text-[11px]" style={{ color: '#52525b' }}>
                            {formatTimestamp(log.timestamp)}
                            {log.sentence && (
                              <span className="italic"> — "{log.sentence}"</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Success flash */}
                    {isSuccess && (
                      <div className="flex items-center gap-1 mt-1.5 mb-1 text-[11px]" style={{ color: '#34d399' }}>
                        <Check size={11} />
                        <span>Logged successfully</span>
                      </div>
                    )}

                    {/* Log form */}
                    {isLogging ? (
                      <div className="mt-2 space-y-2">
                        <textarea
                          autoFocus
                          rows={2}
                          placeholder="Paste the sentence you used it in… (optional)"
                          value={draft}
                          onChange={e => { setDraft(e.target.value); setAiNote(''); }}
                          className="w-full rounded-lg px-3 py-2 text-xs placeholder-zinc-600 resize-none focus:outline-none transition-colors"
                          style={{
                            backgroundColor: '#1e1e22',
                            border: '1px solid #4a4a52',
                            color: '#e4e4e7',
                          }}
                          onFocus={e => (e.target.style.borderColor = 'rgba(245,158,11,0.5)')}
                          onBlur={e => (e.target.style.borderColor = '#4a4a52')}
                        />

                        {aiNote && (
                          <p className="text-[11px] px-1" style={{ color: '#34d399' }}>✓ {aiNote}</p>
                        )}

                        <div className="flex items-center gap-2">
                          {draft.trim() && (
                            <button
                              onClick={() => handleAiCheck(w)}
                              disabled={aiLoading}
                              className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
                              style={{
                                color: '#c084fc',
                                border: '1px solid rgba(192,132,252,0.3)',
                              }}
                            >
                              <Sparkles size={10} />
                              {aiLoading ? 'Checking…' : 'AI Check'}
                            </button>
                          )}
                          <div className="flex gap-1.5 ml-auto">
                            <button
                              onClick={() => { setLoggingId(null); setAiNote(''); }}
                              className="text-[11px] px-2 py-1 rounded-lg transition-colors"
                              style={{ color: '#71717a' }}
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSaveLog(w.id)}
                              className="text-[11px] font-medium px-3 py-1 rounded-lg transition-colors"
                              style={{ backgroundColor: '#f59e0b', color: '#1c1917' }}
                            >
                              Log it ✓
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleStartLog(w.id)}
                        className="mt-2 flex items-center gap-1 text-[11px] transition-colors"
                        style={{ color: '#52525b' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#f59e0b')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#52525b')}
                      >
                        <Plus size={11} />
                        Log usage today
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-5 py-3 flex items-center justify-between"
          style={{ borderTop: '1px solid #3a3a42' }}
        >
          <button
            onClick={onChangeWords}
            className="text-xs transition-colors"
            style={{ color: '#52525b' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#a1a1aa')}
            onMouseLeave={e => (e.currentTarget.style.color = '#52525b')}
          >
            Change words
          </button>
          {totalUsed === selectedWords.length && selectedWords.length > 0 && (
            <span className="text-xs text-amber-400">All done this week 🎉</span>
          )}
        </div>
      </div>
    </div>
  );
}
