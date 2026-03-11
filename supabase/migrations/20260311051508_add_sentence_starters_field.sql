/*
  # Add sentence starters field to vocabulary table

  1. Changes
    - Add `sentence_starters` column to store AI-generated practice prompts
    - This column stores an array of fill-in-the-blank sentences for learning

  2. Notes
    - Uses text array type to store multiple starters
    - Defaults to empty array for existing records
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vocabulary' AND column_name = 'sentence_starters'
  ) THEN
    ALTER TABLE vocabulary ADD COLUMN sentence_starters text[] DEFAULT '{}';
  END IF;
END $$;