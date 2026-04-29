import { ArrowLeft, ChevronRight, Zap } from 'lucide-react';
import type { AnalyzedSession, GrammarErrorData } from '../data/gloriaData';
import { CATEGORY_COLORS } from '../lib/grammar';
import type { GrammarErrorCategory } from '../lib/grammar';
import { inlineDiff } from '../lib/diff';

interface Props {
  session: AnalyzedSession;
  allSessions: AnalyzedSession[];
  onBack: () => void;
  onViewTranscript: () => void;
  onStartPractice?: (errorId: string) => void;
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

// Student-friendly fallback labels (when no grammar_pattern.name)
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

// Badge = important, fix this. No badge = secondary. Style section = optional.
const HIGH_IMPACT = new Set<GrammarErrorCategory>([
  'tense_consistency', 'subject_verb_agreement', 'modal_verb_pattern',
  'verb_form', 'verb_missing', 'verb_redundancy', 'irregular_verb_form',
  'phrasal_verb_errors', 'demonstrative_agreement', 'verb_pattern',
]);

const STYLE_CATEGORIES = new Set<GrammarErrorCategory>([
  'vague_reference', 'parallel_structure', 'word_choice',
  'sentence_structure', 'word_order', 'conjunction_misuse', 'redundant_words',
]);

// ── Types ─────────────────────────────────────────────────────────────────────
interface ErrorGroup {
  key: string;
  tag: string;
  rule: string;
  badgeClasses: string;
  correctionColor: string;
  isHighImpact: boolean;
  isStyle: boolean;
  errors: GrammarErrorData[];
}

function countPatternInOtherSessions(
  patternKey: string,
  currentSessionId: string,
  allSessions: AnalyzedSession[],
): number {
  let count = 0;
  for (const s of allSessions) {
    if (s.id === currentSessionId) continue;
    if (s.errors.some(e => (e.grammar_pattern?.name ?? e.category) === patternKey)) count++;
  }
  return count;
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
        badgeClasses: CATEGORY_COLORS[error.category],
        correctionColor: CORRECTION_TEXT[error.category],
        isHighImpact,
        isStyle,
        errors: [error],
      });
    }
  }

  const byCount = (a: ErrorGroup, b: ErrorGroup) => b.errors.length - a.errors.length;
  const all = Array.from(map.values());
  return {
    high:   all.filter(g => g.isHighImpact).sort(byCount),
    medium: all.filter(g => !g.isHighImpact && !g.isStyle).sort(byCount),
    style:  all.filter(g => g.isStyle),
  };
}

// ── Inline diff renderer ──────────────────────────────────────────────────────
function InlinePair({
  error,
  correctionColor,
  muted = false,
}: {
  error: GrammarErrorData;
  correctionColor: string;
  muted?: boolean;
}) {
  const parts = inlineDiff(error.original, error.corrected);

  return (
    <span className="text-[13px] leading-relaxed">
      {parts.map((p, i) =>
        p.type === 'same' ? (
          <span key={i} className={muted ? 'text-zinc-600' : 'text-zinc-400'}>
            {p.text}
          </span>
        ) : p.type === 'del' ? (
          <span key={i} className="text-zinc-600 line-through decoration-zinc-700">
            {p.text}
          </span>
        ) : (
          <span key={i} className={`font-semibold ${muted ? 'text-zinc-500' : correctionColor}`}>
            {p.text}
          </span>
        ),
      )}
    </span>
  );
}

// ── High-impact group — full visual weight ────────────────────────────────────
function HighGroup({
  group,
  otherSessionCount,
  onStartPractice,
}: {
  group: ErrorGroup;
  otherSessionCount: number;
  onStartPractice?: (errorId: string) => void;
}) {
  const hasPractice =
    group.errors[0]?.practice_sentences && group.errors[0].practice_sentences.length > 0;

  return (
    <div className="py-5 flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2.5 flex-wrap">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${group.badgeClasses}`}>
              {group.tag}
            </span>
            <span className="text-[11px] text-zinc-600">
              {group.errors.length} error{group.errors.length !== 1 ? 's' : ''}
            </span>
            {otherSessionCount > 0 && (
              <span className="text-[11px] text-amber-500/80 font-medium">
                · recurring
              </span>
            )}
          </div>
          {hasPractice && onStartPractice && (
            <button
              onClick={() => onStartPractice(group.errors[0].id)}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-amber-300 transition-colors"
            >
              <Zap size={11} />
              Practice
            </button>
          )}
        </div>
        {group.rule && (
          <p className="text-xs text-zinc-500 leading-relaxed">{group.rule}</p>
        )}
        {otherSessionCount > 0 && (
          <p className="text-[11px] text-zinc-500">
            Also made this mistake in {otherSessionCount} other session{otherSessionCount !== 1 ? 's' : ''} — worth practising
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1.5 pl-1">
        {group.errors.map(error => (
          <InlinePair key={error.id} error={error} correctionColor={group.correctionColor} />
        ))}
      </div>
    </div>
  );
}

// ── Medium group — no badge, muted, compact ───────────────────────────────────
function MediumGroup({ group }: { group: ErrorGroup }) {
  return (
    <div className="py-3.5 flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <span className="text-[11px] text-zinc-400 font-medium">{group.tag}</span>
        {group.rule && (
          <p className="text-[11px] text-zinc-500 leading-relaxed">{group.rule}</p>
        )}
      </div>
      <div className="flex flex-col gap-1 pl-1">
        {group.errors.map(error => (
          <InlinePair key={error.id} error={error} correctionColor={group.correctionColor} muted={false} />
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function GrammarErrorSummary({
  session,
  allSessions,
  onBack,
  onViewTranscript,
  onStartPractice,
}: Props) {
  const { high, medium, style } = groupErrors(session.errors);

  return (
    <div className="max-w-2xl mx-auto w-full flex flex-col pb-16">

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
          <span className="text-sm text-zinc-600">· {session.errors.length} found</span>
        </div>
      </div>

      {/* High-impact groups — solid dividers, full visual weight */}
      {high.map((group, i) => (
        <div key={group.key}>
          <div className={`border-t ${i === 0 ? 'border-zinc-800' : 'border-zinc-800/60'}`} />
          <HighGroup
            group={group}
            otherSessionCount={countPatternInOtherSessions(group.key, session.id, allSessions)}
            onStartPractice={onStartPractice}
          />
        </div>
      ))}

      {/* Medium groups — "also noticed" label then no-badge compact rows */}
      {medium.length > 0 && (
        <>
          <div className="border-t border-zinc-800/60" />
          {high.length > 0 && (
            <p className="text-[10px] text-zinc-700 uppercase tracking-widest pt-4 pb-1">
              also noticed
            </p>
          )}
          {medium.map((group, i) => (
            <div key={group.key}>
              {i > 0 && <div className="border-t border-zinc-800/30" />}
              <MediumGroup group={group} />
            </div>
          ))}
        </>
      )}

      {/* Style section */}
      {style.length > 0 && (
        <>
          <div className="border-t border-zinc-800/30 mt-1" />
          <div className="py-4 flex flex-col gap-2">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">
              style
            </p>
            <p className="text-[11px] text-zinc-400 italic mb-1">
              Valid but could sound more natural
            </p>
            {style.map(group =>
              group.errors.map(error => (
                <InlinePair key={error.id} error={error} correctionColor="text-zinc-500" muted={false} />
              ))
            )}
          </div>
        </>
      )}

      <div className="border-t border-zinc-800/30 mt-1" />

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
