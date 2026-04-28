import { useState, useCallback, useEffect, useRef } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import type { AnalyzedSession, GrammarErrorData } from '../data/gloriaData';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../lib/grammar';
import type { GrammarErrorCategory } from '../lib/grammar';

interface Props {
  session: AnalyzedSession;
  onBack: () => void;
}

// ── Colour mapping for inline correction text ─────────────────────────────────
// One fun colour per broad error family — amber for timing/tense,
// sky for language clarity, violet for form, teal for verbs, orange for prepositions

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

// ── Build annotated segments ──────────────────────────────────────────────────

type Segment =
  | { type: 'text'; text: string }
  | { type: 'error'; error: GrammarErrorData };

function buildSegments(transcript: string, errors: GrammarErrorData[]): Segment[] {
  const positioned = errors
    .map(e => ({ error: e, idx: transcript.indexOf(e.original) }))
    .filter(x => x.idx !== -1)
    .sort((a, b) => a.idx - b.idx);

  const segments: Segment[] = [];
  let cursor = 0;

  for (const { error, idx } of positioned) {
    if (idx > cursor) segments.push({ type: 'text', text: transcript.slice(cursor, idx) });
    segments.push({ type: 'error', error });
    cursor = idx + error.original.length;
  }
  if (cursor < transcript.length) segments.push({ type: 'text', text: transcript.slice(cursor) });
  return segments;
}

// ── Sidebar panel ─────────────────────────────────────────────────────────────

function ErrorSidebar({
  error,
  index,
  total,
  onPrev,
  onNext,
  onClose,
}: {
  error: GrammarErrorData;
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const colorClasses = CATEGORY_COLORS[error.category];
  const correctionColor = CORRECTION_TEXT[error.category];

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg ${colorClasses}`}>
          {CATEGORY_LABELS[error.category]}
        </span>
        <button
          onClick={onClose}
          className="text-zinc-600 hover:text-zinc-400 transition-colors flex-shrink-0 mt-0.5"
        >
          <X size={14} />
        </button>
      </div>

      {/* Was / Now diff */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-3 text-sm leading-relaxed">
          <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest pt-0.5 flex-shrink-0 w-7">
            Was
          </span>
          <span className="text-zinc-600 line-through leading-relaxed">{error.original}</span>
        </div>
        <div className="flex gap-3 text-sm leading-relaxed">
          <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest pt-0.5 flex-shrink-0 w-7">
            Now
          </span>
          <span className={`font-medium leading-relaxed ${correctionColor}`}>{error.corrected}</span>
        </div>
      </div>

      {/* Explanation */}
      <p className="text-[13px] text-zinc-500 leading-[1.8]">{error.explanation}</p>

      {/* Grammar pattern */}
      {error.grammar_pattern && (
        <div className="border-t border-zinc-900 pt-5 flex flex-col gap-3">
          <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">
            {error.grammar_pattern.name}
          </p>
          <p className="text-[12px] text-zinc-600 leading-relaxed">{error.grammar_pattern.structure}</p>
          <div className="pl-3 border-l-2 border-zinc-800 flex flex-col gap-1">
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
  const sidebarRef = useRef<HTMLDivElement>(null);

  const activeError  = activeId ? session.errors.find(e => e.id === activeId) ?? null : null;
  const activeIndex  = activeError ? session.errors.indexOf(activeError) : -1;

  const open  = useCallback((id: string) => setActiveId(id), []);
  const close = useCallback(() => setActiveId(null), []);

  const goPrev = useCallback(() => {
    if (activeIndex > 0) setActiveId(session.errors[activeIndex - 1].id);
  }, [activeIndex, session.errors]);

  const goNext = useCallback(() => {
    if (activeIndex < session.errors.length - 1) setActiveId(session.errors[activeIndex + 1].id);
  }, [activeIndex, session.errors]);

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close(); return; }
      if (!activeId) return;
      if (e.key === 'ArrowLeft')  goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [activeId, close, goPrev, goNext]);

  const segments = buildSegments(session.transcript, session.errors);

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Transcript ── */}
      <div className="flex-1 overflow-y-auto px-14 py-12 min-w-0">

        {/* Header */}
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-8"
        >
          <ArrowLeft size={14} />
          Sessions
        </button>

        <p className="text-[11px] text-zinc-600 uppercase tracking-widest font-semibold mb-1.5">
          {session.speaker} · {session.topic}
        </p>
        <h1 className="text-lg font-semibold text-zinc-100 tracking-tight mb-1">
          IELTS Practice — {session.date}
        </h1>
        <p className="text-xs text-zinc-600 mb-10">
          {session.errors.length} correction{session.errors.length !== 1 ? 's' : ''}
          {session.positive.length > 0 && <> · {session.positive.length} highlights</>}
        </p>

        {/* Annotated transcript */}
        <p className="text-[15px] leading-[2.1] text-zinc-400 max-w-2xl">
          {segments.map((seg, i) => {
            if (seg.type === 'text') {
              return <span key={i}>{seg.text}</span>;
            }
            const { error } = seg;
            const isActive = activeId === error.id;
            const corrColor = CORRECTION_TEXT[error.category];
            return (
              <span
                key={i}
                onClick={() => open(error.id)}
                className={`
                  cursor-pointer rounded-[3px] px-0.5 transition-colors
                  ${isActive ? 'bg-zinc-800/60' : 'hover:bg-zinc-800/30'}
                `}
              >
                <span className="text-zinc-600 line-through decoration-zinc-700">
                  {error.original}
                </span>
                {' '}
                <span className={`font-medium ${corrColor}`}>
                  {error.corrected}
                </span>
              </span>
            );
          })}
        </p>

        {/* Positive feedback */}
        {session.positive.length > 0 && (
          <div className="mt-12 max-w-2xl flex flex-col gap-3">
            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">
              Well said ✦
            </p>
            {session.positive.map((pf, i) => (
              <div
                key={i}
                className="bg-emerald-950/30 border border-emerald-900/30 rounded-xl px-5 py-4"
              >
                <p className="text-[13px] text-emerald-300/80 italic leading-relaxed mb-2">
                  "{pf.segment}"
                </p>
                <p className="text-[12px] text-zinc-600 leading-relaxed">{pf.feedback}</p>
              </div>
            ))}
          </div>
        )}

        {/* Bottom padding */}
        <div className="h-16" />
      </div>

      {/* ── Sidebar ── */}
      <div
        ref={sidebarRef}
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
