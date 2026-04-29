import { useState, useEffect } from 'react';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import type { AnalyzedSession, GrammarErrorData } from '../data/gloriaData';
import { CATEGORY_COLORS } from '../lib/grammar';
import type { GrammarErrorCategory } from '../lib/grammar';
import { inlineDiff } from '../lib/diff';

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

interface Props {
  error: GrammarErrorData;
  session: AnalyzedSession;
  allSessions: AnalyzedSession[];
  onBack: () => void;
}

// Count how many OTHER sessions have this pattern
function countErrorInOtherSessions(
  error: GrammarErrorData,
  currentSessionId: string,
  allSessions: AnalyzedSession[]
): number {
  const patternName = error.grammar_pattern?.name ?? error.category;
  let count = 0;

  for (const s of allSessions) {
    if (s.id === currentSessionId) continue;
    const hasPattern = s.errors.some(
      e => (e.grammar_pattern?.name ?? e.category) === patternName
    );
    if (hasPattern) count++;
  }

  return count;
}

export default function PracticeDrill({
  error,
  session,
  allSessions,
  onBack,
}: Props) {
  const [ruleRevealed, setRuleRevealed] = useState(false);
  const [reveals, setReveals] = useState<boolean[]>(
    error.practice_sentences ? Array(error.practice_sentences.length).fill(false) : []
  );

  // Keyboard: Escape to go back
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onBack]);

  const colorClasses = CATEGORY_COLORS[error.category];
  const correctionColor = CORRECTION_TEXT[error.category];
  const otherSessions = countErrorInOtherSessions(error, session.id, allSessions);

  const toggleReveal = (index: number) => {
    const newReveals = [...reveals];
    newReveals[index] = !newReveals[index];
    setReveals(newReveals);
  };

  return (
    <div className="max-w-2xl mx-auto w-full flex flex-col pb-16">
      {/* Header + Back */}
      <div className="py-5 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft size={14} />
          Back to summary
        </button>
      </div>

      <div className="pb-6">
        <p className="text-[11px] text-zinc-600 uppercase tracking-widest font-semibold mb-2">
          {session.speaker} · {session.topic}
        </p>
        <h1 className="text-base font-semibold text-zinc-100 tracking-tight">
          Practice this pattern
        </h1>
      </div>

      {/* ── RULE CARD ── */}
      <div className="mb-8 py-5 border-t border-zinc-800">
        <button
          onClick={() => setRuleRevealed(!ruleRevealed)}
          className={`w-full p-5 rounded-lg border-2 transition-all ${
            ruleRevealed
              ? 'bg-zinc-800/40 border-zinc-700/60'
              : `${colorClasses} border-transparent hover:border-zinc-600/40 cursor-pointer`
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="text-left flex-1">
              {!ruleRevealed ? (
                <>
                  <p className="text-sm font-medium text-zinc-100 mb-1">
                    {error.grammar_pattern?.name}
                  </p>
                  {error.grammar_pattern?.name_zh && (
                    <p className="text-xs text-zinc-500">
                      ({error.grammar_pattern.name_zh})
                    </p>
                  )}
                  <p className="text-xs text-zinc-600 mt-2">Click to reveal the rule</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-zinc-100 mb-3">
                    {error.grammar_pattern?.structure}
                  </p>
                  {error.grammar_pattern?.structure_zh && (
                    <p className="text-xs text-zinc-500 mb-4">
                      ({error.grammar_pattern.structure_zh})
                    </p>
                  )}
                  <div className="space-y-2">
                    {error.grammar_pattern?.examples.map((ex, i) => (
                      <div key={i}>
                        <p className="text-xs text-zinc-400 leading-relaxed">{ex}</p>
                        {error.grammar_pattern?.examples_zh?.[i] && (
                          <p className="text-xs text-zinc-600 leading-relaxed">
                            ({error.grammar_pattern.examples_zh[i]})
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <RotateCcw
              size={16}
              className={`flex-shrink-0 mt-1 text-zinc-500 transition-transform ${
                ruleRevealed ? 'rotate-180' : ''
              }`}
            />
          </div>
        </button>

        {/* Error prevalence */}
        {otherSessions > 0 && (
          <p className="text-xs text-zinc-400 mt-2 pl-1">
            This pattern appears in {otherSessions} other session{otherSessions !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* ── ANCHOR ERROR ── */}
      <div className="mb-8 py-5 border-t border-zinc-800">
        <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-3">
          See this error:
        </p>

        <div className="mb-3">
          <span className="text-[13px] leading-relaxed">
            {inlineDiff(error.original, error.corrected).map((p, i) =>
              p.type === 'same' ? (
                <span key={i} className="text-zinc-400">
                  {p.text}
                </span>
              ) : p.type === 'del' ? (
                <span key={i} className="text-zinc-600 line-through decoration-zinc-700">
                  {p.text}
                </span>
              ) : (
                <span key={i} className={`font-semibold ${correctionColor}`}>
                  {p.text}
                </span>
              )
            )}
          </span>
        </div>

        {error.explanation && (
          <>
            <p className="text-xs text-zinc-500 leading-relaxed mb-1">{error.explanation}</p>
            {error.explanation_zh && (
              <p className="text-xs text-zinc-700 leading-relaxed">
                ({error.explanation_zh})
              </p>
            )}
          </>
        )}
      </div>

      {/* ── PRACTICE SENTENCES ── */}
      {error.practice_sentences && error.practice_sentences.length > 0 && (
        <div className="py-5 border-t border-zinc-800">
          <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-4">
            Now try these: ({reveals.filter(Boolean).length} / {error.practice_sentences.length})
          </p>

          <div className="space-y-3">
            {error.practice_sentences.map((practice, idx) => {
              const isRevealed = reveals[idx];
              const diffParts = inlineDiff(practice.text, practice.corrected);

              return (
                <div key={practice.id} className="flex flex-col gap-2 p-4 rounded-lg bg-zinc-900/40 border border-zinc-800/50">
                  {/* Front: Practice sentence */}
                  <p className="text-sm text-zinc-300 leading-relaxed">
                    {practice.text}
                  </p>

                  {/* Back: Corrected version (revealed) */}
                  {isRevealed && (
                    <div className="pt-2 border-t border-zinc-800/50">
                      <span className="text-[13px] leading-relaxed">
                        {diffParts.map((p, i) =>
                          p.type === 'same' ? (
                            <span key={i} className="text-zinc-400">
                              {p.text}
                            </span>
                          ) : p.type === 'del' ? (
                            <span key={i} className="text-zinc-600 line-through decoration-zinc-700">
                              {p.text}
                            </span>
                          ) : (
                            <span key={i} className={`font-semibold ${correctionColor}`}>
                              {p.text}
                            </span>
                          )
                        )}
                      </span>
                    </div>
                  )}

                  {/* Flip button */}
                  <button
                    onClick={() => toggleReveal(idx)}
                    className="self-start text-xs text-zinc-600 hover:text-zinc-400 transition-colors mt-1 flex items-center gap-1"
                  >
                    <RotateCcw
                      size={12}
                      className={`transition-transform ${isRevealed ? 'rotate-180' : ''}`}
                    />
                    {isRevealed ? 'Hide' : 'Flip'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 pt-6 border-t border-zinc-800/30">
        <button
          onClick={onBack}
          className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          ← Back to summary
        </button>
      </div>
    </div>
  );
}
