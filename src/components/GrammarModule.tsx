import { useState, useEffect, useMemo } from 'react';
import { Clock, X } from 'lucide-react';
import { useTranscription } from '../lib/useTranscription';
import { usePracticeSession } from '../lib/usePracticeSession';
import TranscriptPanel from './TranscriptPanel';
import SessionDetail from './SessionDetail';
import SessionControlBar from './SessionControlBar';
import { RecordingFeed, relativeTime, formatDuration } from './RecordingFeed';
import type { PracticeSession } from '../lib/grammar';

interface Props {
  userId: string | null;
  locale: 'en-AU' | 'en-US';
  view: 'coach' | 'sessions';
  onSessionEnded: () => void;
}

// ── Sessions list ─────────────────────────────────────────────────────────────
function CompletedSessionRow({
  session, onDelete, onSelect, onRename,
}: {
  session: PracticeSession;
  onDelete: () => void;
  onSelect: () => void;
  onRename: (name: string) => void;
}) {
  const [confirming,  setConfirming]  = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft,   setNameDraft]   = useState('');

  const totalWords    = session.recordings.reduce((n, r) => n + (r.word_count   ?? 0), 0);
  const totalDuration = session.recordings.reduce((n, r) => n + (r.duration_sec ?? 0), 0);
  const first         = session.recordings[0];
  const preview       = first?.transcript.slice(0, 140).trimEnd() ?? '';
  const truncated     = (first?.transcript.length ?? 0) > 140;

  const displayName = session.name
    || new Date(session.completed_at ?? session.created_at).toLocaleDateString(undefined, {
         day: 'numeric', month: 'long', year: 'numeric',
       });

  const startNameEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNameDraft(session.name ?? '');
    setEditingName(true);
  };

  const commitName = () => {
    setEditingName(false);
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== session.name) onRename(trimmed);
  };

  return (
    <div
      className="group flex flex-col gap-2 px-4 py-4 rounded-xl bg-zinc-800/40 border border-zinc-700/50 hover:border-zinc-600/60 transition-colors cursor-pointer"
      onClick={e => { if ((e.target as HTMLElement).closest('button, input')) return; onSelect(); }}
    >
      {/* Name + delete */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {editingName ? (
            <input
              autoFocus
              value={nameDraft}
              onChange={e => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); commitName(); }
                if (e.key === 'Escape') setEditingName(false);
              }}
              className="w-full bg-transparent text-sm font-medium text-zinc-100 outline-none
                border-b border-zinc-500 focus:border-zinc-300 transition-colors"
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <p
              className="text-sm font-medium text-zinc-100 truncate hover:text-white transition-colors"
              onClick={startNameEdit}
              title="Click to rename"
            >
              {displayName}
            </p>
          )}
        </div>

        {confirming ? (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-zinc-500">Delete?</span>
            <button onClick={onDelete} className="text-xs text-rose-400 hover:text-rose-300 transition-colors font-medium">Yes</button>
            <button onClick={() => setConfirming(false)} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">No</button>
          </div>
        ) : (
          <button
            onClick={e => { e.stopPropagation(); setConfirming(true); }}
            className="opacity-0 group-hover:opacity-100 p-1 text-zinc-600 hover:text-rose-400 transition-all shrink-0"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Meta */}
      <div className="flex items-center gap-3 text-xs text-zinc-600">
        <span className="flex items-center gap-1">
          <Clock size={10} />
          {relativeTime(session.completed_at ?? session.created_at)}
        </span>
        <span>{session.recordings.length} recording{session.recordings.length !== 1 ? 's' : ''}</span>
        {totalWords    > 0 && <span>{totalWords} words</span>}
        {totalDuration > 0 && <span>{formatDuration(totalDuration)}</span>}
      </div>

      {/* Preview */}
      {preview && (
        <p className="text-xs text-zinc-500 leading-relaxed">
          {preview}{truncated ? '…' : ''}
        </p>
      )}
    </div>
  );
}

function CompletedSessionsList({
  userId, sessions, loading, onDelete, onSelect, onRename,
}: {
  userId: string | null;
  sessions: PracticeSession[];
  loading: boolean;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
}) {
  if (!userId) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-zinc-500 text-sm">Log in to save and view your sessions.</p>
      </div>
    );
  }
  if (loading) return <p className="text-xs text-zinc-600 py-8 text-center">Loading…</p>;
  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <p className="text-zinc-500 text-sm">No sessions yet.</p>
        <p className="text-xs text-zinc-600">Start a session from Grammar Coach to group your recordings.</p>
      </div>
    );
  }
  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-2">
      {sessions.map(s => (
        <CompletedSessionRow
          key={s.id}
          session={s}
          onDelete={() => onDelete(s.id)}
          onSelect={() => onSelect(s.id)}
          onRename={name => onRename(s.id, name)}
        />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function GrammarModule({ userId, locale, view }: Props) {
  const {
    transcript, interimTranscript,
    isListening, isTranscribing,
    durationSec,
    start, stop, reset,
  } = useTranscription(locale);

  const {
    sessions, activeSession, loading,
    startSession, endSession, discardSession,
    saveSnippet, deleteSession, updateRecording, renameSession,
  } = usePracticeSession(userId);

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [autoSaving,        setAutoSaving]         = useState(false);

  // Flat feed: all recordings newest-first
  const allRecordings = useMemo(() =>
    sessions
      .flatMap(s => s.recordings)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [sessions],
  );

  // Auto-save when Whisper transcript is ready
  useEffect(() => {
    if (!transcript || isListening || isTranscribing || autoSaving) return;
    setAutoSaving(true);
    saveSnippet(transcript, durationSec, null)
      .finally(() => { reset(); setAutoSaving(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, isListening, isTranscribing]);

  // Keyboard shortcut: Space
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return;
      e.preventDefault();
      if      (isListening)                    stop();
      else if (!isTranscribing && !autoSaving) start();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isListening, isTranscribing, autoSaving, start, stop]);

  // ── Sessions view ──────────────────────────────────────────────────────────
  if (view === 'sessions') {
    const selectedSession = selectedSessionId
      ? sessions.find(s => s.id === selectedSessionId) ?? null
      : null;

    if (selectedSession) {
      return (
        <SessionDetail
          session={selectedSession}
          userId={userId}
          onBack={() => setSelectedSessionId(null)}
          onUpdateRecording={updateRecording}
          onRename={name => renameSession(selectedSession.id, name)}
        />
      );
    }
    return (
      <CompletedSessionsList
        userId={userId}
        sessions={sessions}
        loading={loading}
        onDelete={id => { deleteSession(id); if (selectedSessionId === id) setSelectedSessionId(null); }}
        onSelect={setSelectedSessionId}
        onRename={(id, name) => renameSession(id, name)}
      />
    );
  }

  // ── Coach view — recording active ──────────────────────────────────────────
  if (isListening || isTranscribing || autoSaving) {
    return (
      <TranscriptPanel
        transcript={transcript}
        interimTranscript={interimTranscript}
        isListening={isListening}
        isTranscribing={isTranscribing || autoSaving}
        durationSec={durationSec}
        onStop={stop}
      />
    );
  }

  // ── Coach view — feed ──────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5">
      {/* Toolbar */}
      <div className="max-w-2xl mx-auto w-full flex items-center justify-between">
        <p className="text-[11px] text-zinc-600">
          Press{' '}
          <kbd className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-[11px] text-zinc-500">
            Space
          </kbd>{' '}
          to record · again to stop
        </p>

        {!activeSession && (
          <button
            onClick={() => startSession()}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium
              bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border border-zinc-700/60
              transition-all duration-150 active:scale-95"
          >
            New session
          </button>
        )}
      </div>

      {/* Active session control bar */}
      {activeSession && (
        <SessionControlBar
          session={activeSession}
          onEnd={endSession}
          onDiscard={discardSession}
        />
      )}

      <RecordingFeed
        recordings={allRecordings}
        loading={loading}
        userId={userId}
        onSave={updateRecording}
      />
    </div>
  );
}
