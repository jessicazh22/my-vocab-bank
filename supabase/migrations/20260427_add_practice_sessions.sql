-- ── Practice sessions (outer container for multiple recordings) ──────────────
CREATE TABLE IF NOT EXISTS practice_sessions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz            -- NULL = active, set when user ends the session
);

ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their practice sessions"
  ON practice_sessions FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS practice_sessions_user_id_idx
  ON practice_sessions(user_id);

-- ── Link existing grammar_sessions to practice_sessions ───────────────────────
ALTER TABLE grammar_sessions
  ADD COLUMN IF NOT EXISTS practice_session_id uuid REFERENCES practice_sessions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS sort_order           smallint NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS grammar_sessions_practice_session_idx
  ON grammar_sessions(practice_session_id);

-- Wrap every existing standalone recording in its own practice_session
-- so the new UI can query practice_sessions exclusively.
DO $$
DECLARE
  rec   RECORD;
  ps_id uuid;
BEGIN
  FOR rec IN
    SELECT * FROM grammar_sessions WHERE practice_session_id IS NULL
  LOOP
    INSERT INTO practice_sessions (user_id, created_at, completed_at)
    VALUES (rec.user_id, rec.created_at, rec.created_at)
    RETURNING id INTO ps_id;

    UPDATE grammar_sessions
       SET practice_session_id = ps_id,
           sort_order           = 0
     WHERE id = rec.id;
  END LOOP;
END $$;
