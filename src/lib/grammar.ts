// Grammar Analysis module — shared types, labels, and colours
// Calibrated to the gold standard corpus (Gloria, Rina, Tommy transcripts)

export type GrammarErrorCategory =
  // Core grammar
  | 'tense_consistency' | 'subject_verb_agreement' | 'modal_verb_pattern'
  // Articles / determiners
  | 'article_misuse' | 'demonstrative_agreement'
  // Nouns
  | 'singular_plural' | 'uncountable_noun' | 'redundant_words'
  // Verbs
  | 'verb_pattern' | 'verb_form' | 'verb_choice' | 'verb_missing' | 'verb_redundancy'
  | 'irregular_verb_form' | 'comparative_form'
  // Prepositions / particles
  | 'preposition_errors' | 'phrasal_verb_errors'
  // Conjunctions / structure
  | 'conjunction_misuse' | 'conjunction_missing' | 'parallel_structure'
  | 'sentence_structure' | 'word_order'
  // Pronouns
  | 'pronoun_form'
  // Other
  | 'subjunctive_errors' | 'word_form' | 'word_choice' | 'vague_reference';

export interface GrammarPattern {
  name: string;       // e.g. "preposition + gerund"
  structure: string;  // e.g. "preposition + verb-ing (never infinitive or base verb)"
  examples: string[]; // 3–4 concrete examples
}

export interface GrammarError {
  id: string;
  session_id: string;
  original_phrase: string;
  correction: string;
  category: GrammarErrorCategory;
  explanation: string;
  context_snippet: string | null;  // "...surrounding text [original phrase] more text..."
  grammar_pattern: GrammarPattern | null;
  is_confirmed: boolean | null;    // null=pending, true=confirmed, false=dismissed
  sort_order: number;
}

export interface StyleSuggestion {
  id: string;
  session_id: string;
  original_phrase: string;
  suggested: string;
  suggestion_type:
    | 'collocation_word_choice'
    | 'expression_upgrade'
    | 'conciseness'
    | 'phrasing'
    | 'parallel_structure'
    | 'redundant_words'
    | 'sentence_structure'
    | 'natural_expression';
  explanation: string;
  context_snippet: string | null;
  is_dismissed: boolean;
  sort_order: number;
}

export interface PositiveFeedback {
  segment: string;  // exact quoted text from transcript
  feedback: string; // encouraging, specific
}

export interface GrammarSession {
  id: string;
  transcript: string;
  duration_sec: number | null;
  word_count: number | null;
  analyzed_at: string | null;
  created_at: string;
  practice_session_id: string | null;
  sort_order: number;
  speaker: string | null;
}

/** Outer container — one practice session holds 1-N recordings */
export interface PracticeSession {
  id: string;
  created_at: string;
  completed_at: string | null;
  recordings: GrammarSession[];
}

// ── Labels ────────────────────────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<GrammarErrorCategory, string> = {
  tense_consistency:       'Tense',
  subject_verb_agreement:  'Agreement',
  modal_verb_pattern:      'Modal verb',
  article_misuse:          'Articles',
  demonstrative_agreement: 'Demonstrative',
  singular_plural:         'Singular / plural',
  uncountable_noun:        'Uncountable noun',
  redundant_words:         'Redundant word',
  verb_pattern:            'Verb pattern',
  verb_form:               'Verb form',
  verb_choice:             'Verb choice',
  verb_missing:            'Missing verb',
  verb_redundancy:         'Extra verb',
  irregular_verb_form:     'Irregular verb',
  comparative_form:        'Comparative',
  preposition_errors:      'Preposition',
  phrasal_verb_errors:     'Phrasal verb',
  conjunction_misuse:      'Conjunction',
  conjunction_missing:     'Missing conjunction',
  parallel_structure:      'Parallel structure',
  sentence_structure:      'Sentence structure',
  word_order:              'Word order',
  pronoun_form:            'Pronoun',
  subjunctive_errors:      'Subjunctive',
  word_form:               'Word form',
  word_choice:             'Word choice',
  vague_reference:         'Vague reference',
};

// ── Colours — coaching palette, not alarming red ──────────────────────────────

const AMBER  = 'bg-amber-900/30 text-amber-300 border border-amber-800/40';
const ZINC   = 'bg-zinc-700/50 text-zinc-300 border border-zinc-600/40';

// All grammar errors use amber. Style suggestions (StyleSuggestion type) use zinc.
export const CATEGORY_COLORS: Record<GrammarErrorCategory, string> = {
  tense_consistency:       AMBER,
  article_misuse:          AMBER,
  demonstrative_agreement: AMBER,
  singular_plural:         AMBER,
  uncountable_noun:        AMBER,
  redundant_words:         AMBER,
  subject_verb_agreement:  AMBER,
  verb_pattern:            AMBER,
  verb_form:               AMBER,
  verb_choice:             AMBER,
  verb_missing:            AMBER,
  verb_redundancy:         AMBER,
  irregular_verb_form:     AMBER,
  comparative_form:        AMBER,
  modal_verb_pattern:      AMBER,
  subjunctive_errors:      AMBER,
  preposition_errors:      AMBER,
  phrasal_verb_errors:     AMBER,
  parallel_structure:      ZINC,
  sentence_structure:      ZINC,
  word_order:              ZINC,
  conjunction_misuse:      ZINC,
  conjunction_missing:     ZINC,
  pronoun_form:            AMBER,
  vague_reference:         AMBER,
  word_choice:             AMBER,
  word_form:               AMBER,
};

export const STYLE_SUGGESTION_LABELS: Record<StyleSuggestion['suggestion_type'], string> = {
  collocation_word_choice: 'Collocation',
  expression_upgrade:      'Expression',
  conciseness:             'Concise',
  phrasing:                'Phrasing',
  parallel_structure:      'Structure',
  redundant_words:         'Redundant',
  sentence_structure:      'Clarity',
  natural_expression:      'Natural',
};
