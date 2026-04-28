import { useState, useCallback, useEffect } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import type { AnalyzedSession, GrammarErrorData } from '../data/gloriaData';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../lib/grammar';
import type { GrammarErrorCategory } from '../lib/grammar';

interface Props {
  session: AnalyzedSession;
  onBack: () => void;
}

// ── Correction colour per error category ──────────────────────────────────────
const CORRECTION_TEXT: Record<GrammarErrorCategory, string> = {
  tense_consistency:       'text-amber-300',
  subject_verb_agreement:  'text-teal-300',
  modal_verb_pattern:      'text-teal-300',
  article_misuse:          'text-sky-300',
  demonstrative_agreement: 'text-sky-300',
  singular_plural:         'text-violet-400',
  uncountable_noun:        'text-violet-400',
  redundant_words:         'text-violet-400',
  verb_pattern:            'text-teal-300',
  verb_form:               'text-teal-300',
  verb_choice:             'text-teal-300',
  verb_missing:            'text-teal-300',
  verb_redundancy:         'text-teal-300',
  irregular_verb_form:     'text-teal-300',
  comparative_form:        'text-teal-300',
  preposition_errors:      'text-orange-300',
  phrasal_verb_errors:     'text-orange-300',
  conjunction_misuse:      'text-sky-300',
  conjunction_missing:     'text-sky-300',
  parallel_structure:      'text-indigo-300',
  sentence_structure:      'text-indigo-300',
  word_order:              'text-indigo-300',
  pronoun_form:            'text-sky-300',
  subjunctive_errors:      'text-violet-400',
  word_form:               'text-sky-300',
  word_choice:             'text-sky-300',
  vague_reference:         'text-sky-300',
};

// ── Smart inline diff ─────────────────────────────────────────────────────────
// Shows only the specific changed chars, not the whole phrase struck through.
// e.g.  "realise" → "realised"   renders as:  realise[d]
// e.g.  "got"     → "have"       renders as:  ~~got~~ have

type DiffPart = { type: 'same' | 'del' | 'add'; text: string };

function lcsMatrix(a: string[], b: string[]): number[][] {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0),
  );
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
  return dp;
}

function backtrackWords(
  dp: number[][], a: string[], b: string[],
): Array<{ type: 'same' | 'del' | 'add'; item: string }> {
  const ops: Array<{ type: 'same' | 'del' | 'add'; item: string }> = [];
  let i = a.length, j = b.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.unshift({ type: 'same', item: a[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ type: 'add', item: b[j - 1] });
      j--;
    } else {
      ops.unshift({ type: 'del', item: a[i - 1] });
      i--;
    }
  }
  return ops;
}

/** Character-level diff between two strings */
function charDiff(oldStr: string, newStr: string): DiffPart[] {
  const a = oldStr.split('');
  const b = newStr.split('');
  const dp = lcsMatrix(a, b);
  const ops = backtrackWords(dp, a, b);
  const parts: DiffPart[] = [];
  for (const op of ops) {
    const last = parts[parts.length - 1];
    if (last && last.type === op.type) last.text += op.item;
    else parts.push({ type: op.type, text: op.item });
  }
  return parts;
}

/**
 * How many transitions between 'same' and 'changed' exist in the diff.
 * A pure suffix/prefix change has ≤ 1 transition.
 * A middle-of-word change has 2 (same→change→same).
 */
function countTransitions(parts: DiffPart[]): number {
  let count = 0;
  for (let k = 1; k < parts.length; k++) {
    const prevSame = parts[k - 1].type === 'same';
    const currSame = parts[k].type === 'same';
    if (prevSame !== currSame) count++;
  }
  return count;
}

/**
 * Word-level diff with character-level refinement for clean substitutions
 * (e.g. "want"→"wanted" shows want[ed]; "got"→"have" shows ~~got~~ have).
 */
function inlineDiff(original: string, corrected: string): DiffPart[] {
  const origWords = original.split(' ').filter(Boolean);
  const corrWords = corrected.split(' ').filter(Boolean);
  const dp = lcsMatrix(origWords, corrWords);
  const wordOps = backtrackWords(dp, origWords, corrWords);

  // Group consecutive del+add pairs into substitutions
  type GroupedOp =
    | { type: 'same' | 'del' | 'add'; word: string }
    | { type: 'sub'; old: string; new: string };

  const grouped: GroupedOp[] = [];
  for (let k = 0; k < wordOps.length; k++) {
    const op = wordOps[k];
    const next = wordOps[k + 1];
    if (op.type === 'del' && next?.type === 'add') {
      grouped.push({ type: 'sub', old: op.item, new: next.item });
      k++;
    } else {
      grouped.push({ type: op.type as 'same' | 'del' | 'add', word: op.item });
    }
  }

  const result: DiffPart[] = [];

  for (let k = 0; k < grouped.length; k++) {
    const g = grouped[k];

    // Space between words (but not leading space)
    if (k > 0) result.push({ type: 'same', text: ' ' });

    if (g.type === 'same') {
      result.push({ type: 'same', text: g.word });
    } else if (g.type === 'del') {
      result.push({ type: 'del', text: g.word });
    } else if (g.type === 'add') {
      result.push({ type: 'add', text: g.word });
    } else {
      // Substitution: try char-level diff if it's a simple prefix/suffix change
      const parts = charDiff(g.old, g.new);
      const sameLen = parts
        .filter(p => p.type === 'same')
        .reduce((n, p) => n + p.text.length, 0);
      const similarity = sameLen / Math.max(g.old.length, g.new.length);
      const transitions = countTransitions(parts);

      if (similarity > 0.6 && transitions <= 1) {
        // Clean suffix/prefix change — show char diff inline (no extra space)
        result.push(...parts);
      } else {
        // Too different or complex middle change — show as word del + add
        result.push({ type: 'del', text: g.old });
        result.push({ type: 'same', text: ' ' });
        result.push({ type: 'add', text: g.new });
      }
    }
  }

  return result;
}

// ── Segment builder ───────────────────────────────────────────────────────────

type Segment =
  | { type: 'text'; text: string }
  | { type: 'error'; error: GrammarErrorData };

function buildSegments(text: string, errors: GrammarErrorData[]): Segment[] {
  const positioned = errors
    .map(e => ({ error: e, idx: text.indexOf(e.original) }))
    .filter(x => x.idx !== -1)
    .sort((a, b) => a.idx - b.idx);

  const segments: Segment[] = [];
  let cursor = 0;

  for (const { error, idx } of positioned) {
    if (idx > cursor) segments.push({ type: 'text', text: text.slice(cursor, idx) });
    segments.push({ type: 'error', error });
    cursor = idx + error.original.length;
  }
  if (cursor < text.length) segments.push({ type: 'text', text: text.slice(cursor) });
  return segments;
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function ErrorSidebar({
  error, index, total, onPrev, onNext, onClose,
}: {
  error: GrammarErrorData;
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const colorClasses   = CATEGORY_COLORS[error.category];
  const correctionColor = CORRECTION_TEXT[error.category];
  const diffParts      = inlineDiff(error.original, error.corrected);

  return (
    <div className="flex flex-col gap-7 h-full">
      {/* Badge + close */}
      <div className="flex items-start justify-between gap-3">
        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg ${colorClasses}`}>
          {CATEGORY_LABELS[error.category]}
        </span>
        <button
          onClick={onClose}
          className="text-zinc-700 hover:text-zinc-400 transition-colors flex-shrink-0 mt-0.5"
        >
          <X size={14} />
        </button>
      </div>

      {/* Was / Now */}
      <div className="flex flex-col gap-4">
        <div className="flex gap-3">
          <span className="text-[10px] font-semibold text-zinc-700 uppercase tracking-widest pt-1 flex-shrink-0 w-7">
            Was
          </span>
          <span className="text-[13.5px] text-zinc-600 line-through leading-relaxed">
            {error.original}
          </span>
        </div>
        <div className="flex gap-3">
          <span className="text-[10px] font-semibold text-zinc-700 uppercase tracking-widest pt-1 flex-shrink-0 w-7">
            Now
          </span>
          <span className="text-[13.5px] leading-relaxed">
            {diffParts.map((p, i) =>
              p.type === 'same' ? (
                <span key={i} className="text-zinc-300">{p.text}</span>
              ) : p.type === 'del' ? (
                <span key={i} className="text-zinc-600 line-through">{p.text}</span>
              ) : (
                <span key={i} className={`font-semibold ${correctionColor}`}>{p.text}</span>
              ),
            )}
          </span>
        </div>
      </div>

      {/* Explanation */}
      <p className="text-[13px] text-zinc-500 leading-[1.85]">{error.explanation}</p>

      {/* Grammar pattern */}
      {error.grammar_pattern && (
        <div className="border-t border-zinc-900 pt-6 flex flex-col gap-3">
          <p className="text-[10px] font-semibold text-zinc-700 uppercase tracking-widest">
            {error.grammar_pattern.name}
          </p>
          <p className="text-[12px] text-zinc-600 leading-relaxed">{error.grammar_pattern.structure}</p>
          <div className="pl-3 border-l-2 border-zinc-800 flex flex-col gap-0.5">
            {error.grammar_pattern.examples.map((ex, i) => (
              <p key={i} className="text-[12px] text-zinc-600 leading-[1.9]">{ex}</p>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="mt-auto flex items-center justify-between pt-5 border-t border-zinc-900">
        <button
          onClick={onPrev}
          disabled={index === 0}
          className="text-[11px] text-zinc-600 hover:text-zinc-400 disabled:opacity-20 transition-colors"
        >
          ← prev
        </button>
        <span className="text-[11px] text-zinc-800">{index + 1} / {total}</span>
        <button
          onClick={onNext}
          disabled={index === total - 1}
          className="text-[11px] text-zinc-600 hover:text-zinc-400 disabled:opacity-20 transition-colors"
        >
          next →
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GrammarAnalysis({ session, onBack }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const activeError = activeId ? session.errors.find(e => e.id === activeId) ?? null : null;
  const activeIndex = activeError ? session.errors.indexOf(activeError) : -1;

  const open  = useCallback((id: string) => setActiveId(id), []);
  const close = useCallback(() => setActiveId(null), []);

  const goPrev = useCallback(() => {
    if (activeIndex > 0) setActiveId(session.errors[activeIndex - 1].id);
  }, [activeIndex, session.errors]);

  const goNext = useCallback(() => {
    if (activeIndex < session.errors.length - 1)
      setActiveId(session.errors[activeIndex + 1].id);
  }, [activeIndex, session.errors]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape')      { close(); return; }
      if (!activeId)               return;
      if (e.key === 'ArrowLeft')   goPrev();
      if (e.key === 'ArrowRight')  goNext();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [activeId, close, goPrev, goNext]);

  // Split transcript into paragraphs; build segments per paragraph
  const paragraphs = session.transcript.split(/\n\n+/);
  const segsByPara = paragraphs.map(para => {
    const paraErrors = session.errors.filter(e => para.includes(e.original));
    return buildSegments(para, paraErrors);
  });

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Transcript ── */}
      <div className="flex-1 overflow-y-auto px-14 py-12 min-w-0">

        {/* Back */}
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-10"
        >
          <ArrowLeft size={14} />
          Sessions
        </button>

        {/* Meta */}
        <p className="text-[11px] text-zinc-600 uppercase tracking-widest font-semibold mb-2">
          {session.speaker} · {session.topic}
        </p>
        <h1 className="text-[17px] font-semibold text-zinc-100 tracking-tight mb-1.5">
          IELTS Practice — {session.date}
        </h1>
        <p className="text-xs text-zinc-600 mb-12">
          {session.errors.length} correction{session.errors.length !== 1 ? 's' : ''}
          {session.positive.length > 0 && <> · {session.positive.length} highlights</>}
        </p>

        {/* Annotated transcript — one <p> per paragraph */}
        <div className="flex flex-col gap-7 max-w-2xl">
          {segsByPara.map((segments, pi) => (
            <p key={pi} className="text-[15.5px] leading-[2.1] text-zinc-300">
              {segments.map((seg, si) => {
                if (seg.type === 'text') {
                  return <span key={si}>{seg.text}</span>;
                }

                const { error } = seg;
                const isActive   = activeId === error.id;
                const corrColor  = CORRECTION_TEXT[error.category];
                const diffParts  = inlineDiff(error.original, error.corrected);

                return (
                  <span
                    key={si}
                    onClick={() => open(error.id)}
                    className={`cursor-pointer rounded-[3px] px-0.5 transition-colors ${
                      isActive ? 'bg-zinc-800/70' : 'hover:bg-zinc-800/40'
                    }`}
                  >
                    {diffParts.map((p, di) =>
                      p.type === 'same' ? (
                        <span key={di}>{p.text}</span>
                      ) : p.type === 'del' ? (
                        <span key={di} className="text-zinc-600 line-through decoration-zinc-700">
                          {p.text}
                        </span>
                      ) : (
                        <span key={di} className={`font-semibold ${corrColor}`}>
                          {p.text}
                        </span>
                      ),
                    )}
                  </span>
                );
              })}
            </p>
          ))}
        </div>

        {/* Positive feedback */}
        {session.positive.length > 0 && (
          <div className="mt-14 max-w-2xl flex flex-col gap-3">
            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-1">
              Well said ✦
            </p>
            {session.positive.map((pf, i) => (
              <div
                key={i}
                className="bg-emerald-950/30 border border-emerald-900/30 rounded-xl px-5 py-4"
              >
                <p className="text-[13px] text-emerald-300/70 italic leading-relaxed mb-2">
                  "{pf.segment}"
                </p>
                <p className="text-[12px] text-zinc-600 leading-relaxed">{pf.feedback}</p>
              </div>
            ))}
          </div>
        )}

        <div className="h-16" />
      </div>

      {/* ── Sidebar ── */}
      <div
        className="transition-[width] duration-200 ease-out overflow-hidden flex-shrink-0"
        style={{ width: activeError ? 300 : 0 }}
      >
        {activeError && (
          <div className="w-[300px] h-full border-l border-zinc-900 bg-[#0c0c0e] px-7 py-12 overflow-y-auto">
            <ErrorSidebar
              error={activeError}
              index={activeIndex}
              total={session.errors.length}
              onPrev={goPrev}
              onNext={goNext}
              onClose={close}
            />
          </div>
        )}
      </div>

    </div>
  );
}
