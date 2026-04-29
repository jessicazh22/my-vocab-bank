import { ArrowLeft, ChevronRight } from 'lucide-react';
import type { AnalyzedSession, GrammarErrorData } from '../data/gloriaData';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../lib/grammar';
import type { GrammarErrorCategory } from '../lib/grammar';

interface Props {
  session: AnalyzedSession;
  onBack: () => void;
  onViewTranscript: () => void;
}

// ── Correction text colours (matches GrammarAnalysis) ────────────────────────
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

// ── Grouping ──────────────────────────────────────────────────────────────────

interface ErrorGroup {
  key: string;
  displayName: string;
  rule: string;
  colorClasses: string;
  correctionColor: string;
  errors: GrammarErrorData[];
}

function groupErrors(errors: GrammarErrorData[]): ErrorGroup[] {
  const map = new Map<string, ErrorGroup>();

  for (const error of errors) {
    const key = error.grammar_pattern?.name ?? CATEGORY_LABELS[error.category];

    if (map.has(key)) {
      map.get(key)!.errors.push(error);
    } else {
      map.set(key, {
        key,
        displayName: (error.grammar_pattern?.name ?? CATEGORY_LABELS[error.category]).toUpperCase(),
        rule: error.grammar_pattern?.structure ?? '',
        colorClasses: CATEGORY_COLORS[error.category],
        correctionColor: CORRECTION_TEXT[error.category],
        errors: [error],
      });
    }
  }

  // Most frequent first
  return Array.from(map.values()).sort((a, b) => b.errors.length - a.errors.length);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function GrammarErrorSummary({ session, onBack, onViewTranscript }: Props) {
  const groups = groupErrors(session.errors);

  return (
    <div className="max-w-2xl mx-auto w-full flex flex-col gap-0 pb-16">

      {/* Nav */}
      <div className="py-5 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft size={14} />
          Sessions
        </button>
        <button
          onClick={onViewTranscript}
          className="flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          View transcript
          <ChevronRight size={12} />
        </button>
      </div>

      {/* Header */}
      <div className="pb-5">
        <p className="text-[11px] text-zinc-600 uppercase tracking-widest font-semibold mb-1">
          {session.speaker} · {session.topic}
        </p>
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-base font-semibold text-zinc-100 tracking-tight">
            YOUR ERRORS TODAY
          </h1>
          <span className="text-sm text-zinc-600">
            · {session.errors.length} found
          </span>
        </div>
      </div>

      {/* Groups */}
      <div className="flex flex-col">
        {groups.map((group) => (
          <div key={group.key}>
            {/* Divider */}
            <div className="border-t border-zinc-800" />

            {/* Group body */}
            <div className="py-5 flex flex-col gap-3">

              {/* Group header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${group.colorClasses}`}>
                      {group.displayName}
                    </span>
                    <span className="text-[11px] text-zinc-600">
                      {group.errors.length} error{group.errors.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {group.rule && (
                    <p className="text-xs text-zinc-500 leading-relaxed mt-0.5">
                      {group.rule}
                    </p>
                  )}
                </div>
              </div>

              {/* Error pairs */}
              <div className="flex flex-col gap-1.5 pl-1">
                {group.errors.map((error) => (
                  <div key={error.id} className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-[13px] text-zinc-600 line-through decoration-zinc-700">
                      {error.original}
                    </span>
                    <span className="text-zinc-700 text-xs shrink-0">→</span>
                    <span className={`text-[13px] font-medium ${group.correctionColor}`}>
                      {error.corrected}
                    </span>
                  </div>
                ))}
              </div>

              {/* Practice CTA — placeholder for next milestone */}
              <button
                disabled
                className="self-start flex items-center gap-1.5 text-xs text-zinc-700 cursor-not-allowed mt-0.5"
              >
                Practice these
                <ChevronRight size={11} />
                <span className="text-[10px] text-zinc-800 ml-0.5">coming soon</span>
              </button>

            </div>
          </div>
        ))}

        <div className="border-t border-zinc-800" />
      </div>

      {/* Footer */}
      <div className="pt-6 flex items-center gap-4">
        <button
          disabled
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
            bg-zinc-800/40 text-zinc-600 border border-zinc-700/40 cursor-not-allowed"
        >
          Practice all
          <span className="text-[10px] text-zinc-700">coming soon</span>
        </button>
        <button
          onClick={onViewTranscript}
          className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          View transcript →
        </button>
      </div>

    </div>
  );
}
