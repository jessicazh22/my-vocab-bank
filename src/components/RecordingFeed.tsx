import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, X, ArrowLeftRight } from 'lucide-react';
import type { GrammarSession } from '../lib/grammar';

// ── Helpers ───────────────────────────────────────────────────────────────────

export function addParagraphBreaks(text: string): string {
  if (text.length < 100) return text;
  // Split at sentence-ending punctuation followed by a capital letter
  const sentences = text.split(/(?<=[.?!])\s+(?=[A-Z])/);
  if (sentences.length <= 1) return text;
  const paras: string[] = [];
  let current = '';
  for (const sent of sentences) {
    current = current ? `${current} ${sent}` : sent;
    if (current.length >= 220) {
      paras.push(current);
      current = '';
    }
  }
  if (current) paras.push(current);
  return paras.join('\n\n');
}

export function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth()      === b.getMonth()
    && a.getDate()       === b.getDate();
}

export function groupByDate(recordings: GrammarSession[]) {
  const groups: { key: string; label: string; items: GrammarSession[] }[] = [];
  const today     = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  for (const rec of recordings) {
    const date = new Date(rec.created_at);
    let label: string;
    if      (isSameDay(date, today))     label = 'Today';
    else if (isSameDay(date, yesterday)) label = 'Yesterday';
    else label = date.toLocaleDateString(undefined, {
      weekday: undefined, day: 'numeric', month: 'long', year: 'numeric',
    }).toUpperCase();

    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(rec);
    else groups.push({ key: label, label, items: [rec] });
  }
  return groups;
}

export function relativeTime(iso: string): string {
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

export function formatDuration(sec: number | null): string {
  if (!sec) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ── Recording row (feed entry) ────────────────────────────────────────────────

export const SPEAKER_COLORS: Record<string, string> = {
  Teacher: 'text-amber-400',
  Student: 'text-sky-400',
};

const LABEL_COLORS: Record<string, string> = {
  Gloria:  'text-amber-400',
  Jessica: 'text-sky-400',
};

function StyledTranscript({ text }: { text: string }) {
  const paragraphs = text.split('\n\n').filter(Boolean);
  const hasSpeakers = paragraphs.some(p => /^(Gloria|Jessica):\s/.test(p));
  if (!hasSpeakers) {
    const paras = addParagraphBreaks(text).split('\n\n').filter(Boolean);
    return (
      <div className="flex flex-col gap-2">
        {paras.map((p, i) => (
          <p key={i} className="text-sm text-zinc-200 leading-relaxed">{p}</p>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {paragraphs.map((para, i) => {
        const match = para.match(/^(\w+):\s*([\s\S]*)$/);
        if (match) {
          const [, name, content] = match;
          const contentParas = addParagraphBreaks(content).split('\n\n').filter(Boolean);
          return (
            <div key={i} className="flex flex-col gap-0.5">
              <span className={`text-[11px] font-semibold uppercase tracking-wider ${LABEL_COLORS[name] ?? 'text-zinc-400'}`}>
                {name}
              </span>
              {contentParas.map((p, j) => (
                <p key={j} className="text-sm text-zinc-200 leading-relaxed">{p}</p>
              ))}
            </div>
          );
        }
        return <p key={i} className="text-sm text-zinc-200 leading-relaxed">{para}</p>;
      })}
    </div>
  );
}

export function RecordingRow({
  rec,
  onSave,
  onDelete,
}: {
  rec: GrammarSession;
  onSave: (id: string, text: string) => Promise<void>;
  onDelete?: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState('');
  const [saving,  setSaving]  = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const time = new Date(rec.created_at).toLocaleTimeString(undefined, {
    hour: '2-digit', minute: '2-digit',
  });

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, []);

  const enterEdit = () => {
    setDraft(rec.transcript);
    setEditing(true);
  };

  useEffect(() => {
    if (!editing) return;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    autoResize();
  }, [editing, autoResize]);

  const commitSave = useCallback(async () => {
    if (saving) return;
    if (draft === rec.transcript) { setEditing(false); return; }
    setSaving(true);
    await onSave(rec.id, draft);
    setSaving(false);
    setEditing(false);
  }, [draft, rec.transcript, rec.id, onSave, saving]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitSave();
    }
    if (e.key === 'Escape') {
      setEditing(false);
      setDraft('');
    }
  };

  return (
    <div
      className={`group flex gap-5 px-5 py-4 transition-colors ${editing ? 'bg-zinc-800/40' : 'hover:bg-zinc-800/25 cursor-text'}`}
      onClick={!editing ? enterEdit : undefined}
    >
      {/* Time + speaker */}
      <div className="flex flex-col gap-0.5 shrink-0 w-[4.5rem] pt-0.5">
        <span className="text-xs text-zinc-500 tabular-nums">{time}</span>
        {rec.speaker && (
          <span className={`text-[10px] font-medium ${SPEAKER_COLORS[rec.speaker] ?? 'text-zinc-400'}`}>
            {rec.speaker}
          </span>
        )}
      </div>

      {/* Text or editor */}
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        {editing ? (
          <>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={e => { setDraft(e.target.value); autoResize(); }}
              onKeyDown={handleKeyDown}
              onBlur={commitSave}
              rows={1}
              className="w-full bg-transparent text-sm text-zinc-200 leading-relaxed
                resize-none outline-none border-b border-zinc-600 focus:border-zinc-400
                transition-colors pb-0.5"
            />
            <p className="text-[10px] text-zinc-600 select-none">
              {saving ? 'Saving…' : '↵ save · Esc cancel'}
            </p>
          </>
        ) : (
          <StyledTranscript text={rec.transcript} />
        )}
      </div>

      {/* Swap + Delete */}
      {!editing && (
        <div className="opacity-0 group-hover:opacity-100 shrink-0 self-start mt-0.5 flex items-center gap-0.5 transition-all">
          <button
            onClick={e => {
              e.stopPropagation();
              const swapped = rec.transcript
                .replace(/^Gloria:/gm, '\x00T\x00')
                .replace(/^Jessica:/gm, 'Gloria:')
                .replace(/^\x00T\x00/gm, 'Jessica:');
              onSave(rec.id, swapped);
            }}
            className="p-1 text-zinc-600 hover:text-sky-400 transition-colors"
            title="Swap Gloria ⇄ Jessica"
          >
            <ArrowLeftRight size={13} />
          </button>
          {onDelete && (
            <button
              onClick={e => { e.stopPropagation(); onDelete(rec.id); }}
              className="p-1 text-zinc-600 hover:text-rose-400 transition-colors"
            >
              <X size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Recording feed ────────────────────────────────────────────────────────────

export function RecordingFeed({
  recordings, loading, userId, onSave, onDelete,
}: {
  recordings: GrammarSession[];
  loading: boolean;
  userId: string | null;
  onSave: (id: string, text: string) => Promise<void>;
  onDelete?: (id: string) => void;
}) {
  if (!userId) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <p className="text-zinc-500 text-sm">Log in to save recordings.</p>
      </div>
    );
  }
  if (loading) return <p className="text-xs text-zinc-600 py-12 text-center">Loading…</p>;
  if (recordings.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center">
          <Mic size={18} className="text-zinc-600" />
        </div>
        <p className="text-zinc-500 text-sm">No recordings yet.</p>
        <p className="text-xs text-zinc-600">
          Press{' '}
          <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-[11px] text-zinc-400">
            Space
          </kbd>{' '}
          to start.
        </p>
      </div>
    );
  }

  const groups = groupByDate(recordings);

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-7">
      {groups.map(({ key, label, items }) => (
        <div key={key} className="flex flex-col gap-2.5">
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-medium px-1">
            {label}
          </p>
          <div className="rounded-xl border border-zinc-800 divide-y divide-zinc-800/80 overflow-hidden bg-zinc-900/40">
            {items.map(rec => (
              <RecordingRow key={rec.id} rec={rec} onSave={onSave} onDelete={onDelete} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
