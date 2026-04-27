-- Grammar Analysis Module — run this in Supabase Dashboard > SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Error category enum
CREATE TYPE grammar_error_category AS ENUM (
  -- Core grammar
  'tense_consistency', 'subject_verb_agreement', 'modal_verb_pattern',
  -- Articles / determiners
  'article_misuse', 'demonstrative_agreement',
  -- Nouns
  'singular_plural', 'uncountable_noun', 'redundant_words',
  -- Verbs
  'verb_pattern', 'verb_form', 'verb_choice', 'verb_missing', 'verb_redundancy',
  'irregular_verb_form', 'comparative_form',
  -- Prepositions / particles
  'preposition_errors', 'phrasal_verb_errors',
  -- Conjunctions / structure
  'conjunction_misuse', 'conjunction_missing', 'parallel_structure',
  'sentence_structure', 'word_order',
  -- Pronouns
  'pronoun_form',
  -- Other
  'subjunctive_errors', 'word_form', 'word_choice', 'vague_reference'
);

-- 2. Grammar sessions
CREATE TABLE grammar_sessions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transcript    text        NOT NULL,
  duration_sec  integer,
  word_count    integer,
  analyzed_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE grammar_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their grammar sessions"
  ON grammar_sessions FOR ALL USING (auth.uid() = user_id);

-- 3. Grammar errors (per session)
CREATE TABLE grammar_errors (
  id              uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid                    NOT NULL REFERENCES grammar_sessions(id) ON DELETE CASCADE,
  user_id         uuid                    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_phrase text                    NOT NULL,
  correction      text                    NOT NULL,
  category        grammar_error_category  NOT NULL,
  explanation     text                    NOT NULL,
  context_snippet text,
  grammar_pattern jsonb,      -- { name, structure, examples[] }
  is_confirmed    boolean,    -- null = pending, true = confirmed, false = dismissed
  sort_order      smallint    NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE grammar_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their grammar errors"
  ON grammar_errors FOR ALL USING (auth.uid() = user_id);

-- 4. Style suggestions (per session)
CREATE TABLE grammar_style_suggestions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid        NOT NULL REFERENCES grammar_sessions(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_phrase text        NOT NULL,
  suggested       text        NOT NULL,
  suggestion_type text        NOT NULL,
  explanation     text        NOT NULL,
  context_snippet text,
  is_dismissed    boolean     NOT NULL DEFAULT false,
  sort_order      smallint    NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE grammar_style_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their style suggestions"
  ON grammar_style_suggestions FOR ALL USING (auth.uid() = user_id);
