/*
  # Add Source Tag Field

  1. Changes
    - Adds `source_tag` column to vocabulary table for tracking where words/phrases/sentences were found
    - Examples: "George Saunders - A Swim in a Pond in the Rain", "The Economist", etc.

  2. Purpose
    - Allows users to remember where they encountered a word or phrase
    - Enables filtering by source in future
*/

ALTER TABLE vocabulary 
ADD COLUMN IF NOT EXISTS source_tag text;