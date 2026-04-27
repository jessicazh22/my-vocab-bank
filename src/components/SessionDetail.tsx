import { useState } from 'react';
import { ArrowLeft, Pencil, Check } from 'lucide-react';
import type { PracticeSession } from '../lib/grammar';

interface Props {
  session: PracticeSession;
  onBack: () => void;
  onUpdateRecording: (recordingId: string, transcript: string) => Promise<void>;
}

function formatDuration(sec: number | null): string {
  if (!sec) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function SessionDetail({ session, onBack, onUpdateRecording }: Props) {
  const [editing, setEditing]   = useState(false);
  const [drafts,  setDrafts]    = useState<Record<string, string>>({});
  const [saving,  setSaving]    = useState(false);

  const totalWords    = session.recordings.reduce((n, r) => n + (r.word_count   ?? 0), 0);
  const totalDuration = session.recordings.reduce((n, r) => n + (r.duration_sec ?? 0), 0);

  const date = new Date(session.completed_at ?? session.created_at).toLocaleDateString(
    undefined, { day: 'numeric', month: 'long', year: 'numeric' },
  );

  const handleStartEdit = () => {
    const init: Record<string, string> = {};
    session.recordings.forEach(r => { init[r.id] = r.transcript; });
    setDrafts(init);
    setEditing(true);
  };

  const handleCancel = () => {
    setDrafts({});
    setEditing(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const changed = session.recordings.filter(
      r => drafts[r.id] !== undefined && drafts[r.id] !== r.transcript,
    );
    await Promise.all(changed.map(r => onUpdateRecording(r.id, drafts[r.id])));
    setSaving(false);
    setEditing(false);
    setDrafts({});
  };

  const hasChanges = session.recordings.some(
    r => drafts[r.id] !== undefined && drafts[r.id] !== r.transcript,
  );

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-7">

      {/* Nav row */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft size={14} />
          Sessions
        </button>

        {editing ? (
          <div className="flex items-center gap-4">
            <button
              onClick={handleCancel}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300
                disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Check size={12} />
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        ) : (
          <button
            onClick={handleStartEdit}
            className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            <Pencil size={11} />
            Edit
          </button>
        )}
      </div>

      {/* Session meta */}
      <div>
        <p className="text-base font-medium text-zinc-100">{date}</p>
        <p className="mt-1 text-xs text-zinc-500">
          {session.recordings.length} recording{session.recordings.length !== 1 ? 's' : ''}
          {totalWords    > 0 && <> · {totalWords} words</>}
          {totalDuration > 0 && <> · {formatDuration(totalDuration)}</>}
        </p>
      </div>

      {/* Combined transcript */}
      <div>
        {session.recordings.map((rec, i) => (
          <div key={rec.id}>

            {/* Inter-recording divider */}
            {i > 0 && (
              <div className="flex items-center gap-3 my-8">
                <div className="h-px flex-1 bg-zinc-800" />
                <span className="text-[11px] text-zinc-600">
                  Recording {i + 1}{rec.duration_sec ? ` · ${formatDuration(rec.duration_sec)}` : ''}
                </span>
                <div className="h-px flex-1 bg-zinc-800" />
              </div>
            )}

            {editing ? (
              <textarea
                value={drafts[rec.id] ?? rec.transcript}
                onChange={e => setDrafts(prev => ({ ...prev, [rec.id]: e.target.value }))}
                rows={Math.max(4, Math.ceil((drafts[rec.id] ?? rec.transcript).length / 68))}
                className="w-full bg-zinc-800/40 border border-zinc-700/60 rounded-xl px-5 py-4
                  text-sm text-zinc-200 leading-relaxed resize-none
                  focus:outline-none focus:border-zinc-500 transition-colors"
              />
            ) : (
              <p className="text-sm text-zinc-200 leading-[1.85] whitespace-pre-wrap">
                {rec.transcript}
              </p>
            )}

          </div>
        ))}
      </div>

    </div>
  );
}
