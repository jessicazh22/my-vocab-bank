/*
  # Add familiarity level to vocabulary

  1. Changes
    - Add `familiarity` column to vocabulary table
    - Values: 'NEED_TO_LEARN' (need to learn definition + usage) or 'NEED_TO_USE' (know meaning, need more practice)
    - Default to 'NEED_TO_LEARN' for new entries
    - Only applies to words in LEARNING category

  2. Notes
    - This allows sub-sectioning within the Learning category
    - Words marked 'NEED_TO_USE' are ones where user knows meaning but wants more practice
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vocabulary' AND column_name = 'familiarity'
  ) THEN
    ALTER TABLE vocabulary ADD COLUMN familiarity text DEFAULT 'NEED_TO_LEARN';
  END IF;
END $$;
