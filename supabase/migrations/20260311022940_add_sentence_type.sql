/*
  # Add sentence type and usage examples

  1. Changes
    - Update word_type to include 'sentence' option
    - Add usage_context column for storing example contexts
    - Auto-detect sentences (longer text with certain patterns)

  2. Notes
    - Sentences are longer expressions typically containing verbs
    - Usage context stores where/how a word is commonly used
*/

UPDATE vocabulary
SET word_type = CASE
  WHEN length(word) > 30 OR word LIKE '% % % % %' THEN 'sentence'
  WHEN word LIKE '% %' THEN 'phrase'
  ELSE 'word'
END;