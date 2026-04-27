import { useState, useEffect } from 'react';
import { Mic, CheckCircle2, Trash2, Clock } from 'lucide-react';
import { useTranscription } from '../lib/useTranscription';
import { useGrammarSession } from '../lib/useGrammarSession';
import TranscriptPanel from './TranscriptPanel';
import type { GrammarSession } from '../lib/grammar';

interface Props {
  userId: string | null;
  locale: 'en-AU' | 'en-US';
}

const FEATURES = [
  'Speak freely — no scripts, no prompts',
  'Errors flagged by category with plain-English explanations',
  'Style suggestions to sound more natural',
  'What you did well, always highlighted first',
];

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

// ── Session row ──────────────────────────────────────────────────────────────
function SessionRow({ session, onDelete }: { session: GrammarSession; onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const preview   = session.transcript.slice(0, 160).trimEnd();
  const truncated = session.transcript.length > 160;

  return (
    <div className="group flex flex-col gap-2.5 px-4 py-4 rounded-xl bg-zinc-800/40 border border-zinc-700/50 hover:border-zinc-600/60 transition-colors">
      {/* Meta row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span className="flex items-center gap-1.5">
            <Clock size={11} />
            {relativeTime(session.created_at)}
          </span>
          {session.word_count != null && (
            <span className="text-zinc-600">{session.word_count} words</span>
          )}
          {session.duration_sec != null && (
            <span className="text-zinc-600">{formatDuration(session.duration_sec)}</span>
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
            onClick={() => setConfirming(true)}
            className="opacity-0 group-hover:opacity-100 p-1 text-zinc-600 hover:text-rose-400 transition-all"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* Transcript preview */}
      <p className="text-xs text-zinc-500 leading-relaxed">
        {preview}{truncated ? '…' : ''}
      </p>
    </div>
  );
}

// ── Sessions tab ─────────────────────────────────────────────────────────────
function SessionsTab({
  userId,
  sessions,
  loading,
  onDelete,
  onRecord,
}: {
  userId: string | null;
  sessions: GrammarSession[];
  loading: boolean;
  onDelete: (id: string) => void;
  onRecord: () => void;
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
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-zinc-500 text-sm">No saved sessions yet.</p>
        <button
          onClick={onRecord}
          className="text-xs text-amber-400 hover:text-amber-300 transition-colors underline underline-offset-2"
        >
          Record your first session
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {sessions.map(s => (
        <SessionRow key={s.id} session={s} onDelete={() => onDelete(s.id)} />
      ))}
    </div>
  );
}

// ── Record tab (idle) ────────────────────────────────────────────────────────
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
          Start recording
        </button>
      ) : (
        <p className="text-xs text-zinc-600 text-center">
          Audio recording isn't supported in this browser.<br />Try Chrome or Edge.
        </p>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function GrammarModule({ userId, locale }: Props) {
  const [activeTab, setActiveTab] = useState<'record' | 'sessions'>('record');

  const {
    transcript, interimTranscript,
    isListening, isTranscribing,
    supported, durationSec,
    start, stop, reset,
  } = useTranscription(locale);

  const { sessions, loading: sessionsLoading, saveSession, deleteSession } = useGrammarSession(userId);

  const [editedTranscript, setEditedTranscript] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedDuration, setSavedDuration] = useState(0);

  useEffect(() => {
    if (transcript) {
      setEditedTranscript(transcript);
      setSavedDuration(durationSec);
    }
  }, [transcript]); // eslint-disable-line react-hooks/exhaustive-deps

  const editedWordCount = editedTranscript.trim()
    ? editedTranscript.trim().split(/\s+/).filter(Boolean).length
    : 0;

  const handleSave = async () => {
    if (!editedTranscript.trim() || !userId) return;
    setSaving(true);
    await saveSession(editedTranscript.trim(), savedDuration);
    setSaving(false);
    reset();
    setActiveTab('sessions'); // jump straight to the list after saving
  };

  // Recording / transcribing — always full-screen, no tabs
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

  // Post-recording: edit + save — no tabs, focused flow
  if (transcript) {
    return (
      <div className="max-w-2xl mx-auto flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-500">
            <span className="text-zinc-300 font-medium">{editedWordCount}</span> words
          </p>
          <button onClick={reset} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
            Discard &amp; start over
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

        <div className="flex items-center justify-center gap-3 pt-1">
          <button
            onClick={handleSave}
            disabled={!editedTranscript.trim() || saving || !userId}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium
              bg-zinc-700 hover:bg-zinc-600 text-zinc-100 border border-zinc-600
              disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 active:scale-95"
          >
            {saving ? 'Saving…' : 'Save transcript'}
          </button>
          <button
            disabled
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium
              bg-amber-900/20 text-amber-500/50 border border-amber-800/30 cursor-not-allowed select-none"
          >
            <Mic size={14} />
            Analyse
            <span className="text-[10px] text-amber-600/50 uppercase tracking-wider">soon</span>
          </button>
        </div>

        {!userId && (
          <p className="text-xs text-center text-zinc-600">Log in to save transcripts.</p>
        )}
      </div>
    );
  }

  // Idle — show tab bar + content
  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-0">

      {/* Internal tab bar */}
      <div className="flex gap-1 border-b border-zinc-800 mb-6">
        {(['record', 'sessions'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`relative px-4 py-2.5 text-sm transition-colors capitalize ${
              activeTab === tab
                ? 'text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab}
            {tab === 'sessions' && sessions.length > 0 && (
              <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                activeTab === 'sessions'
                  ? 'bg-zinc-700 text-zinc-300'
                  : 'bg-zinc-800 text-zinc-500'
              }`}>
                {sessions.length}
              </span>
            )}
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-px bg-amber-500" />
            )}
          </button>
        ))}
      </div>

      {activeTab === 'record' ? (
        <RecordIdle supported={supported} onStart={start} />
      ) : (
        <SessionsTab
          userId={userId}
          sessions={sessions}
          loading={sessionsLoading}
          onDelete={deleteSession}
          onRecord={() => setActiveTab('record')}
        />
      )}
    </div>
  );
}
