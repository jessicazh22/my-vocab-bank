import { useState, useEffect } from 'react';
import { Mic, CheckCircle2, Clock, X, ChevronRight } from 'lucide-react';
import { useTranscription } from '../lib/useTranscription';
import { usePracticeSession } from '../lib/usePracticeSession';
import TranscriptPanel from './TranscriptPanel';
import type { PracticeSession } from '../lib/grammar';

interface Props {
  userId: string | null;
  locale: 'en-AU' | 'en-US';
  view: 'coach' | 'sessions';
  onSessionEnded: () => void;
}

const FEATURES = [
  'Speak freely — no scripts, no prompts',
  'Errors flagged by category with plain-English explanations',
  'Style suggestions to sound more natural',
  'What you did well, always highlighted first',
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function relativeTime(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  <  1) return 'just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  <  7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function formatDuration(sec: number | null): string {
  if (!sec) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ── Completed session row ─────────────────────────────────────────────────────
function CompletedSessionRow({
  session,
  onDelete,
}: {
  session: PracticeSession;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  const totalWords    = session.recordings.reduce((n, r) => n + (r.word_count    ?? 0), 0);
  const totalDuration = session.recordings.reduce((n, r) => n + (r.duration_sec  ?? 0), 0);
  const first         = session.recordings[0];
  const preview       = first?.transcript.slice(0, 160).trimEnd() ?? '';
  const truncated     = (first?.transcript.length ?? 0) > 160;

  return (
    <div className="group flex flex-col gap-2.5 px-4 py-4 rounded-xl bg-zinc-800/40 border border-zinc-700/50 hover:border-zinc-600/60 transition-colors">
      {/* Meta row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span className="flex items-center gap-1.5">
            <Clock size={11} />
            {relativeTime(session.completed_at ?? session.created_at)}
          </span>
          <span className="text-zinc-600">
            {session.recordings.length} recording{session.recordings.length !== 1 ? 's' : ''}
          </span>
          {totalWords > 0    && <span className="text-zinc-600">{totalWords} words</span>}
          {totalDuration > 0 && <span className="text-zinc-600">{formatDuration(totalDuration)}</span>}
        </div>

        {confirming ? (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-zinc-500">Delete?</span>
            <button onClick={onDelete}             className="text-xs text-rose-400 hover:text-rose-300 transition-colors font-medium">Yes</button>
            <button onClick={() => setConfirming(false)} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">No</button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="opacity-0 group-hover:opacity-100 p-1 text-zinc-600 hover:text-rose-400 transition-all"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* First recording preview */}
      {preview && (
        <p className="text-xs text-zinc-500 leading-relaxed">
          {preview}{truncated ? '…' : ''}
        </p>
      )}
    </div>
  );
}

// ── Completed sessions list ───────────────────────────────────────────────────
function CompletedSessionsList({
  userId,
  sessions,
  loading,
  onDelete,
}: {
  userId: string | null;
  sessions: PracticeSession[];
  loading: boolean;
  onDelete: (id: string) => void;
}) {
  if (!userId) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-zinc-500 text-sm">Log in to save and view your sessions.</p>
      </div>
    );
  }

  if (loading) {
    return <p className="text-xs text-zinc-600 py-8 text-center">Loading…</p>;
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <p className="text-zinc-500 text-sm">No completed sessions yet.</p>
        <p className="text-xs text-zinc-600">Head to Grammar Coach to start your first session.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-2">
      {sessions.map(s => (
        <CompletedSessionRow key={s.id} session={s} onDelete={() => onDelete(s.id)} />
      ))}
    </div>
  );
}

// ── Idle (no active session) ──────────────────────────────────────────────────
function RecordIdle({ supported, onStart }: { supported: boolean; onStart: () => void }) {
  return (
    <div className="flex flex-col items-center gap-8 py-12">
      <div className="relative">
        <div className="w-14 h-14 rounded-2xl bg-amber-900/25 border border-amber-800/40 flex items-center justify-center">
          <Mic size={24} className="text-amber-400" />
        </div>
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500/30 border border-amber-500/50" />
      </div>

      <div className="text-center max-w-sm">
        <h2 className="text-lg font-medium text-zinc-100 mb-2">Grammar Coach</h2>
        <p className="text-zinc-500 text-sm leading-relaxed">
          Record yourself speaking on any topic and get personalised coaching on grammar, word choice, and what you're already doing well.
        </p>
      </div>

      <ul className="w-full max-w-sm flex flex-col gap-2">
        {FEATURES.map(f => (
          <li key={f} className="flex items-start gap-3 text-sm text-zinc-400">
            <CheckCircle2 size={14} className="text-amber-500/70 mt-0.5 shrink-0" />
            {f}
          </li>
        ))}
      </ul>

      {supported ? (
        <button
          onClick={onStart}
          className="flex items-center gap-2.5 px-7 py-3 rounded-xl text-sm font-medium
            bg-amber-900/30 hover:bg-amber-900/50 text-amber-300 border border-amber-800/40
            transition-all duration-150 active:scale-95"
        >
          <Mic size={15} />
          Start session
        </button>
      ) : (
        <p className="text-xs text-zinc-600 text-center">
          Audio recording isn't supported in this browser.<br />Try Chrome or Edge.
        </p>
      )}
    </div>
  );
}

// ── Active session view ───────────────────────────────────────────────────────
function ActiveSessionView({
  session,
  onRecord,
  onEnd,
  onDiscard,
  onRemoveRecording,
}: {
  session: PracticeSession;
  onRecord: () => void;
  onEnd: () => void;
  onDiscard: () => void;
  onRemoveRecording: (id: string) => void;
}) {
  const hasRecordings = session.recordings.length > 0;

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-50" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
        </span>
        <span className="text-sm text-zinc-300 font-medium">Session in progress</span>
        {hasRecordings && (
          <span className="text-xs text-zinc-600 ml-1">
            · {session.recordings.length} recording{session.recordings.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Recordings list */}
      {hasRecordings ? (
        <div className="flex flex-col gap-2">
          {session.recordings.map((rec, i) => (
            <div
              key={rec.id}
              className="group flex flex-col gap-1.5 px-4 py-3.5 rounded-xl bg-zinc-800/30 border border-zinc-700/40"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-xs text-zinc-500">
                  <span className="text-zinc-400 font-medium">Recording {i + 1}</span>
                  {rec.duration_sec != null && <><span className="text-zinc-700">·</span><span>{formatDuration(rec.duration_sec)}</span></>}
                  {rec.word_count   != null && <><span className="text-zinc-700">·</span><span>{rec.word_count} words</span></>}
                </div>
                <button
                  onClick={() => onRemoveRecording(rec.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-zinc-600 hover:text-rose-400 transition-all"
                >
                  <X size={12} />
                </button>
              </div>
              <p className="text-xs text-zinc-600 leading-relaxed">
                {rec.transcript.slice(0, 120).trimEnd()}{rec.transcript.length > 120 ? '…' : ''}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="border border-dashed border-zinc-700/50 rounded-xl px-6 py-8 text-center">
          <p className="text-sm text-zinc-600">No recordings yet — start your first one below.</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-1">
        {hasRecordings ? (
          <button
            onClick={onEnd}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium
              bg-zinc-700/60 hover:bg-zinc-700 text-zinc-200 border border-zinc-600/50
              transition-all duration-150 active:scale-95"
          >
            End session
            <ChevronRight size={14} />
          </button>
        ) : (
          <button
            onClick={onDiscard}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Cancel session
          </button>
        )}

        <button
          onClick={onRecord}
          className="flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-sm font-medium
            bg-amber-900/30 hover:bg-amber-900/50 text-amber-300 border border-amber-800/40
            transition-all duration-150 active:scale-95"
        >
          <Mic size={14} />
          {hasRecordings ? 'Record again' : 'Start recording'}
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function GrammarModule({ userId, locale, view, onSessionEnded }: Props) {
  const {
    transcript, interimTranscript,
    isListening, isTranscribing,
    supported, durationSec,
    start, stop, reset,
  } = useTranscription(locale);

  const {
    sessions, activeSession, loading,
    startSession, addRecording, removeRecording,
    endSession, discardSession, deleteSession,
  } = usePracticeSession(userId);

  const [editedTranscript, setEditedTranscript] = useState('');
  const [savedDuration, setSavedDuration]       = useState(0);
  const [adding, setAdding]                     = useState(false);

  useEffect(() => {
    if (transcript) {
      setEditedTranscript(transcript);
      setSavedDuration(durationSec);
    }
  }, [transcript]); // eslint-disable-line react-hooks/exhaustive-deps

  const editedWordCount = editedTranscript.trim()
    ? editedTranscript.trim().split(/\s+/).filter(Boolean).length
    : 0;

  const handleStartSession = async () => {
    await startSession();
    start();
  };

  const handleAddToSession = async () => {
    if (!editedTranscript.trim() || adding) return;
    setAdding(true);
    await addRecording(editedTranscript.trim(), savedDuration);
    setAdding(false);
    reset();
  };

  const handleDiscardRecording = () => {
    reset();
  };

  const handleEndSession = async () => {
    await endSession();
    onSessionEnded();
  };

  // ── 1. Sessions view (controlled by sidebar nav) ──────────────────────────
  if (view === 'sessions') {
    return (
      <CompletedSessionsList
        userId={userId}
        sessions={sessions}
        loading={loading}
        onDelete={deleteSession}
      />
    );
  }

  // ── 2. Recording / transcribing ───────────────────────────────────────────
  if (isListening || isTranscribing) {
    return (
      <TranscriptPanel
        transcript={transcript}
        interimTranscript={interimTranscript}
        isListening={isListening}
        isTranscribing={isTranscribing}
        durationSec={durationSec}
        onStop={stop}
      />
    );
  }

  // ── 3. Editing — transcript ready, in active session ─────────────────────
  if (transcript && activeSession) {
    return (
      <div className="max-w-2xl mx-auto flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-500">
            <span className="text-zinc-300 font-medium">{editedWordCount}</span> words
          </p>
          <button
            onClick={handleDiscardRecording}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Discard recording
          </button>
        </div>

        <textarea
          value={editedTranscript}
          onChange={e => setEditedTranscript(e.target.value)}
          rows={10}
          className="w-full bg-zinc-800/40 border border-zinc-700/60 rounded-xl px-5 py-4
            text-sm text-zinc-200 leading-relaxed resize-none
            focus:outline-none focus:border-zinc-500 transition-colors
            placeholder:text-zinc-600"
          placeholder="Your transcript will appear here…"
        />
        <p className="text-xs text-zinc-600 -mt-2">Fix any transcription errors before saving.</p>

        <div className="flex justify-end pt-1">
          <button
            onClick={handleAddToSession}
            disabled={!editedTranscript.trim() || adding}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium
              bg-amber-900/30 hover:bg-amber-900/50 text-amber-300 border border-amber-800/40
              disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 active:scale-95"
          >
            {adding ? 'Saving…' : 'Add to session'}
          </button>
        </div>
      </div>
    );
  }

  // ── 4. Active session ─────────────────────────────────────────────────────
  if (activeSession) {
    return (
      <ActiveSessionView
        session={activeSession}
        onRecord={start}
        onEnd={handleEndSession}
        onDiscard={discardSession}
        onRemoveRecording={removeRecording}
      />
    );
  }

  // ── 5. Idle ───────────────────────────────────────────────────────────────
  return <RecordIdle supported={supported} onStart={handleStartSession} />;
}
