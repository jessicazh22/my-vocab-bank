/*
  # Rename sentence_starters to scaffold_prompt

  1. Changes
    - Add `scaffold_prompt` text column to vocabulary table
    - This replaces the array-based sentence_starters with a single reflection prompt
    - The scaffold_prompt contains a personalized question to help learners connect words to their experience

  2. Notes
    - Keeping sentence_starters column for backward compatibility during transition
    - New enrichment will populate scaffold_prompt instead
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vocabulary' AND column_name = 'scaffold_prompt'
  ) THEN
    ALTER TABLE vocabulary ADD COLUMN scaffold_prompt text;
  END IF;
END $$;