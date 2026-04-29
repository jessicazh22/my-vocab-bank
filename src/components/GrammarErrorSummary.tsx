import { ArrowLeft, ChevronRight } from 'lucide-react';
import type { AnalyzedSession, GrammarErrorData } from '../data/gloriaData';
import { CATEGORY_COLORS } from '../lib/grammar';
import type { GrammarErrorCategory } from '../lib/grammar';

interface Props {
  session: AnalyzedSession;
  onBack: () => void;
  onViewTranscript: () => void;
}

// ── Correction colours ────────────────────────────────────────────────────────
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

// Student-friendly fallback labels when no grammar_pattern.name exists
const STUDENT_LABELS: Record<GrammarErrorCategory, string> = {
  tense_consistency:       'Past tense',
  subject_verb_agreement:  'Subject + verb',
  modal_verb_pattern:      'Might / could + base verb',
  article_misuse:          'The / a / an',
  demonstrative_agreement: 'This / these',
  singular_plural:         'Singular / plural',
  uncountable_noun:        'Uncountable noun',
  redundant_words:         'Extra word',
  verb_pattern:            '-ing form',
  verb_form:               'Verb ending',
  verb_choice:             'Wrong verb',
  verb_missing:            "Gonna needs 'are / is'",
  verb_redundancy:         'Extra verb',
  irregular_verb_form:     'Irregular verb',
  comparative_form:        'Comparing',
  preposition_errors:      'Preposition (on / in / at)',
  phrasal_verb_errors:     'Phrasal verb',
  conjunction_misuse:      'Connecting words',
  conjunction_missing:     'Missing connector',
  parallel_structure:      'Parallel structure',
  sentence_structure:      'Sentence structure',
  word_order:              'Word order',
  pronoun_form:            'Pronoun',
  subjunctive_errors:      'If it were',
  word_form:               'Word form',
  word_choice:             'Word choice',
  vague_reference:         'Too vague',
};

// High-impact: errors that most affect how native you sound
const HIGH_IMPACT = new Set<GrammarErrorCategory>([
  'tense_consistency', 'subject_verb_agreement', 'modal_verb_pattern',
  'verb_form', 'verb_missing', 'verb_redundancy', 'irregular_verb_form',
  'phrasal_verb_errors', 'demonstrative_agreement', 'verb_pattern',
]);

// Style suggestions: valid choices that could just be more natural
const STYLE_CATEGORIES = new Set<GrammarErrorCategory>([
  'vague_reference', 'parallel_structure', 'word_choice',
  'sentence_structure', 'word_order', 'conjunction_misuse', 'redundant_words',
]);

// ── Types ─────────────────────────────────────────────────────────────────────
interface ErrorGroup {
  key: string;
  tag: string;
  rule: string;
  colorClasses: string;
  correctionColor: string;
  isHighImpact: boolean;
  isStyle: boolean;
  errors: GrammarErrorData[];
}

// ── Grouping ──────────────────────────────────────────────────────────────────
function groupErrors(errors: GrammarErrorData[]): {
  high: ErrorGroup[];
  medium: ErrorGroup[];
  style: ErrorGroup[];
} {
  const map = new Map<string, ErrorGroup>();

  for (const error of errors) {
    const key = error.grammar_pattern?.name ?? error.category;
    const isStyle = STYLE_CATEGORIES.has(error.category);
    const isHighImpact = HIGH_IMPACT.has(error.category) && !isStyle;

    if (map.has(key)) {
      map.get(key)!.errors.push(error);
    } else {
      map.set(key, {
        key,
        tag: error.grammar_pattern?.name ?? STUDENT_LABELS[error.category],
        rule: error.grammar_pattern?.structure ?? '',
        colorClasses: isStyle
          ? 'bg-zinc-800/60 text-zinc-500 border border-zinc-700/40'
          : CATEGORY_COLORS[error.category],
        correctionColor: isStyle ? 'text-zinc-400' : CORRECTION_TEXT[error.category],
        isHighImpact,
        isStyle,
        errors: [error],
      });
    }
  }

  const sort = (a: ErrorGroup, b: ErrorGroup) => b.errors.length - a.errors.length;

  const all = Array.from(map.values());
  return {
    high:   all.filter(g => g.isHighImpact).sort(sort),
    medium: all.filter(g => !g.isHighImpact && !g.isStyle).sort(sort),
    style:  all.filter(g => g.isStyle),
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="flex-1 border-t border-dashed border-zinc-800" />
      <span className="text-[10px] text-zinc-700 uppercase tracking-widest shrink-0">
        {label}
      </span>
      <div className="flex-1 border-t border-dashed border-zinc-800" />
    </div>
  );
}

function GroupRow({ group }: { group: ErrorGroup }) {
  return (
    <div className="py-5 flex flex-col gap-3">
      {/* Tag + count + rule */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${group.colorClasses}`}>
            {group.tag}
          </span>
          <span className="text-[11px] text-zinc-600">
            {group.errors.length} error{group.errors.length !== 1 ? 's' : ''}
          </span>
        </div>
        {group.rule && (
          <p className="text-xs text-zinc-500 leading-relaxed">
            {group.rule}
          </p>
        )}
      </div>

      {/* Error pairs */}
      <div className="flex flex-col gap-1.5 pl-1">
        {group.errors.map(error => (
          <div key={error.id} className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[13px] text-zinc-400 line-through decoration-zinc-600">
              {error.original}
            </span>
            <span className="text-zinc-700 text-xs shrink-0">→</span>
            <span className={`text-[13px] font-medium ${group.correctionColor}`}>
              {error.corrected}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GrammarErrorSummary({ session, onBack, onViewTranscript }: Props) {
  const { high, medium, style } = groupErrors(session.errors);
  const totalGroups = high.length + medium.length + style.length;

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
            Your errors today
          </h1>
          <span className="text-sm text-zinc-600">
            · {session.errors.length} found
          </span>
        </div>
      </div>

      {/* Groups */}
      <div className="flex flex-col">

        {/* High impact */}
        {high.map((group, i) => (
          <div key={group.key}>
            <div className="border-t border-zinc-800" />
            <GroupRow group={group} />
            {i === high.length - 1 && medium.length === 0 && totalGroups > high.length && null}
          </div>
        ))}

        {/* Also noticed divider + medium */}
        {medium.length > 0 && (
          <>
            <div className="border-t border-zinc-800" />
            {high.length > 0 && (
              <div className="pt-4 pb-1">
                <Divider label="also noticed" />
              </div>
            )}
            {medium.map(group => (
              <div key={group.key}>
                <GroupRow group={group} />
              </div>
            ))}
          </>
        )}

        {/* Style divider + style suggestions */}
        {style.length > 0 && (
          <>
            {(high.length > 0 || medium.length > 0) && (
              <div className="pt-2 pb-1">
                <Divider label="style" />
              </div>
            )}
            <div className="py-3 flex flex-col gap-1">
              <p className="text-[11px] text-zinc-600 italic mb-1">
                Valid but could sound more natural
              </p>
              {style.map(group =>
                group.errors.map(error => (
                  <div key={error.id} className="flex items-baseline gap-2 flex-wrap pl-1">
                    <span className="text-[13px] text-zinc-600 line-through decoration-zinc-700">
                      {error.original}
                    </span>
                    <span className="text-zinc-800 text-xs shrink-0">→</span>
                    <span className="text-[13px] text-zinc-500">
                      {error.corrected}
                    </span>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        <div className="border-t border-zinc-800 mt-2" />
      </div>

      {/* Footer */}
      <div className="pt-6">
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
